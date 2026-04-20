import { marked } from "marked";

/**
 * Smart-paste transformer.
 *
 * When the user pastes into the TipTap editor we try to preserve structure
 * rather than flattening the clipboard into a single paragraph. The rules,
 * in priority order:
 *
 *   1. If the clipboard carries HTML (e.g. from Google Docs, Notion, a web
 *      page), sanitize it - strip scripts, styles, classes, inline event
 *      handlers - and let TipTap's own schema reconcile it.
 *   2. If the plain-text payload looks like Markdown, run `marked` over it
 *      and return the resulting HTML.
 *   3. Otherwise, fall back to block-level heuristics (first short line is
 *      the title, all-caps / title-case lines are subheadings, lines that
 *      start with a verb and end without a period are CTAs, bullet lists
 *      are recognized by leading dashes / asterisks / digits).
 *
 * Returns an HTML string to inject, or `null` to hand the paste back to
 * TipTap's default handler.
 */

export interface SmartPasteInput {
  html?: string;
  text?: string;
}

// -- Sanitizer ---------------------------------------------------------------

/**
 * Tags we intentionally strip. `<br>` is preserved but converted to a
 * paragraph break downstream when it shows up mid-block.
 */
const STRIP_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "META",
  "LINK",
  "NOSCRIPT",
  "OBJECT",
  "EMBED",
  "IFRAME",
  "FORM",
  "INPUT",
  "BUTTON",
  "SVG",
  "IMG",
]);

/**
 * Attributes we allow to survive on any element. Everything else (class, id,
 * style, data-*, event handlers) is dropped.
 */
const KEEP_ATTRS = new Set(["href", "rel", "target"]);

/**
 * Google Docs wraps everything in Mso / id-prefixed spans. Strip them so the
 * resulting HTML matches TipTap's schema.
 */
function sanitizeHtml(rawHtml: string): string {
  if (typeof window === "undefined" || !window.DOMParser) {
    // SSR fallback - leave the HTML alone, TipTap's schema will filter.
    return rawHtml;
  }
  const doc = new DOMParser().parseFromString(rawHtml, "text/html");
  walk(doc.body);
  return doc.body.innerHTML;
}

function walk(node: Element) {
  // Walk children first so we can safely mutate the current node afterwards.
  for (const child of Array.from(node.children)) {
    walk(child);
  }
  if (STRIP_TAGS.has(node.tagName)) {
    node.remove();
    return;
  }
  // Drop disallowed attributes.
  for (const attr of Array.from(node.attributes)) {
    if (!KEEP_ATTRS.has(attr.name.toLowerCase())) {
      node.removeAttribute(attr.name);
    }
  }
}

// -- Markdown detection ------------------------------------------------------

/**
 * Heuristic: treat the paste as Markdown if we see two or more of these
 * features. Keeping it conservative - a single `#` isn't enough to tip it.
 */
export function looksLikeMarkdown(text: string): boolean {
  if (!text) return false;
  let score = 0;
  if (/^#{1,3}\s+\S/m.test(text)) score += 2; // ATX headings
  if (/^\s*[-*+]\s+\S/m.test(text)) score += 1; // bullet list
  if (/^\s*\d+\.\s+\S/m.test(text)) score += 1; // ordered list
  if (/\[[^\]]+\]\([^)]+\)/.test(text)) score += 1; // links
  if (/(\*\*|__)[^*_]+\1/.test(text)) score += 1; // bold
  if (/(^|\s)(\*|_)[^*_\n]+\2(\s|$)/.test(text)) score += 1; // italic
  if (/^>\s+\S/m.test(text)) score += 1; // blockquote
  if (/^```/m.test(text)) score += 2; // code fence
  return score >= 2;
}

// -- Plain-text heuristics ---------------------------------------------------

const CTA_VERBS = /^(?:start|get|try|buy|download|sign up|book|subscribe|join|learn more|read more|shop|order|claim|request|contact|schedule|reserve|watch|explore|discover|apply|create|build|launch|activate|continue)\b/i;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function looksLikeCta(line: string): boolean {
  const t = line.trim();
  if (!t || t.length > 70) return false;
  if (t.endsWith(".")) return false;
  return CTA_VERBS.test(t);
}

function looksLikeSubheading(line: string): boolean {
  const t = line.trim();
  if (!t || t.length > 70) return false;
  if (t.endsWith(".") || t.endsWith("?") || t.endsWith("!")) return false;
  // Title Case (each significant word starts upper) - cheap proxy.
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length < 2) return false;
  const titleCase = words.every((w) => /^[A-Z0-9]/.test(w) || /^(a|an|the|of|for|and|or|in|on|to|with|vs)$/i.test(w));
  return titleCase;
}

/**
 * Group an array of raw lines into block objects so we don't lose list
 * grouping (dash/asterisk/numeric).
 */
type Block =
  | { kind: "title"; text: string }
  | { kind: "h2"; text: string }
  | { kind: "cta"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "p"; text: string };

function plainTextToBlocks(text: string): Block[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let buffer: string[] = [];

  const flushParagraph = () => {
    if (!buffer.length) return;
    const joined = buffer.join(" ").trim();
    if (joined) blocks.push({ kind: "p", text: joined });
    buffer = [];
  };

  let i = 0;
  let titleAssigned = false;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      i++;
      continue;
    }

    // Bullet run (dash / asterisk / plus).
    if (/^[-*+]\s+\S/.test(trimmed)) {
      flushParagraph();
      const items: string[] = [];
      while (i < lines.length && /^[-*+]\s+\S/.test(lines[i]?.trim() ?? "")) {
        items.push((lines[i]?.trim() ?? "").replace(/^[-*+]\s+/, ""));
        i++;
      }
      blocks.push({ kind: "ul", items });
      continue;
    }

    // Numbered run.
    if (/^\d+[.)]\s+\S/.test(trimmed)) {
      flushParagraph();
      const items: string[] = [];
      while (i < lines.length && /^\d+[.)]\s+\S/.test(lines[i]?.trim() ?? "")) {
        items.push((lines[i]?.trim() ?? "").replace(/^\d+[.)]\s+/, ""));
        i++;
      }
      blocks.push({ kind: "ol", items });
      continue;
    }

    // Single-line standalone block: could be title / h2 / cta.
    const isSingle =
      !buffer.length &&
      (i + 1 >= lines.length || (lines[i + 1]?.trim() ?? "") === "");

    if (!titleAssigned && isSingle && trimmed.length <= 80 && !trimmed.endsWith(".")) {
      blocks.push({ kind: "title", text: trimmed });
      titleAssigned = true;
      i++;
      continue;
    }

    if (isSingle && looksLikeCta(trimmed)) {
      blocks.push({ kind: "cta", text: trimmed });
      i++;
      continue;
    }

    if (isSingle && looksLikeSubheading(trimmed)) {
      blocks.push({ kind: "h2", text: trimmed });
      i++;
      continue;
    }

    // Accumulate into the current paragraph.
    buffer.push(trimmed);
    i++;
  }

  flushParagraph();
  return blocks;
}

function blocksToHtml(blocks: Block[]): string {
  const parts: string[] = [];
  for (const b of blocks) {
    switch (b.kind) {
      case "title":
        parts.push(`<h1>${escapeHtml(b.text)}</h1>`);
        break;
      case "h2":
        parts.push(`<h2>${escapeHtml(b.text)}</h2>`);
        break;
      case "cta":
        parts.push(
          `<p><a class="wryte-cta" href="#">${escapeHtml(b.text)}</a></p>`,
        );
        break;
      case "ul":
        parts.push(
          `<ul>${b.items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`,
        );
        break;
      case "ol":
        parts.push(
          `<ol>${b.items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ol>`,
        );
        break;
      case "p":
        parts.push(`<p>${escapeHtml(b.text)}</p>`);
        break;
    }
  }
  return parts.join("");
}

// -- Public entrypoint -------------------------------------------------------

export function smartPasteHtml({ html, text }: SmartPasteInput): string | null {
  const rawHtml = (html || "").trim();
  const rawText = (text || "").trim();

  if (!rawHtml && !rawText) return null;

  // 1. HTML wins.
  if (rawHtml) {
    return sanitizeHtml(rawHtml);
  }

  // 2. Markdown.
  if (looksLikeMarkdown(rawText)) {
    return marked.parse(rawText, { async: false }) as string;
  }

  // 3. Plain-text heuristics.
  const blocks = plainTextToBlocks(rawText);
  if (!blocks.length) return null;
  return blocksToHtml(blocks);
}
