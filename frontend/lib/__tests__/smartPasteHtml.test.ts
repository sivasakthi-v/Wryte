import { describe, expect, it } from "vitest";
import { looksLikeMarkdown, smartPasteHtml } from "../smartPasteHtml";

describe("looksLikeMarkdown", () => {
  it("flags text with multiple markdown features", () => {
    const text = "# Heading\n\n- one\n- two\n\n**bold** text";
    expect(looksLikeMarkdown(text)).toBe(true);
  });

  it("rejects plain prose that happens to contain a hash", () => {
    const text = "Meet us at booth #42 for details.";
    expect(looksLikeMarkdown(text)).toBe(false);
  });

  it("flags fenced code blocks", () => {
    const text = "Here is some code:\n\n```\nconst x = 1\n```";
    expect(looksLikeMarkdown(text)).toBe(true);
  });
});

describe("smartPasteHtml - HTML path", () => {
  it("strips <script>, <style>, inline handlers, and classes", () => {
    const html =
      '<div class="g-doc" style="font:12px"><script>alert(1)</script>' +
      '<h1 onclick="x()">Title</h1><p class="gd">Body</p></div>';
    const out = smartPasteHtml({ html });
    expect(out).not.toBeNull();
    expect(out).not.toContain("script");
    expect(out).not.toContain("onclick");
    expect(out).not.toContain("class=");
    expect(out).toContain("<h1>Title</h1>");
    expect(out).toContain("<p>Body</p>");
  });

  it("preserves href on anchors", () => {
    const html = '<p>See <a href="https://example.com">docs</a>.</p>';
    const out = smartPasteHtml({ html });
    expect(out).toContain('href="https://example.com"');
  });
});

describe("smartPasteHtml - Markdown path", () => {
  it("converts markdown to HTML", () => {
    const text = "# Hello\n\n- one\n- two\n\n**bold**";
    const out = smartPasteHtml({ text });
    expect(out).not.toBeNull();
    expect(out).toContain("<h1>Hello</h1>");
    expect(out).toContain("<li>one</li>");
    expect(out).toContain("<strong>bold</strong>");
  });
});

describe("smartPasteHtml - plain-text heuristics", () => {
  it("promotes a short first line to <h1>", () => {
    const text = "Ship faster with Wryte\n\nThis is the body paragraph.";
    const out = smartPasteHtml({ text });
    expect(out).toContain("<h1>Ship faster with Wryte</h1>");
    expect(out).toContain("<p>This is the body paragraph.</p>");
  });

  it("detects a Title Case standalone line as h2", () => {
    const text =
      "Ship faster with Wryte\n\nIntroductory paragraph goes here.\n\nWhy It Works\n\nMore body text follows.";
    const out = smartPasteHtml({ text });
    expect(out).toContain("<h2>Why It Works</h2>");
  });

  it("wraps verb-led short lines into CTA anchors", () => {
    const text =
      "Ship faster with Wryte\n\nSome intro copy here.\n\nStart your free analysis";
    const out = smartPasteHtml({ text });
    expect(out).toContain('class="wryte-cta"');
    expect(out).toContain("Start your free analysis");
  });

  it("preserves bullet groupings", () => {
    const text =
      "Ship faster with Wryte\n\nHere is the pitch.\n\n- readability\n- structure\n- intent";
    const out = smartPasteHtml({ text });
    expect(out).toContain("<ul>");
    expect(out).toContain("<li>readability</li>");
    expect(out).toContain("<li>intent</li>");
  });

  it("preserves numbered lists", () => {
    const text = "Steps\n\n1. first\n2. second\n3. third";
    const out = smartPasteHtml({ text });
    expect(out).toContain("<ol>");
    expect(out).toContain("<li>first</li>");
  });

  it("returns null for empty clipboards", () => {
    expect(smartPasteHtml({ text: "", html: "" })).toBeNull();
  });

  it("escapes raw HTML in plain-text input", () => {
    const text = "Hello\n\nI <3 angle brackets & ampersands.";
    const out = smartPasteHtml({ text });
    expect(out).not.toBeNull();
    expect(out).toContain("&lt;");
    expect(out).toContain("&amp;");
  });
});
