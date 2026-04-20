"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect } from "react";

import { cn } from "@/lib/utils";
import { Toolbar } from "./Toolbar";

export interface SmartPasteInput {
  html?: string;
  text?: string;
}

export interface EditorProps {
  /** Current editor value as HTML. Controlled by the parent (usually the Zustand store). */
  value: string;
  /** Fired whenever the editor content changes - receives sanitized HTML. */
  onChange: (html: string) => void;
  /**
   * Optional transformer that runs on paste events. Returns an HTML string to
   * insert, or `null` to fall through to TipTap's default paste handling.
   */
  onSmartPaste?: (clipboard: SmartPasteInput) => string | null;
  /** Placeholder shown when the editor is empty. */
  placeholder?: string;
  /** Extra classes applied to the outer wrapper. */
  className?: string;
  /** Minimum visible height of the editable surface in px. Defaults to 500. */
  minHeight?: number;
}

/**
 * TipTap rich-text editor with a sticky toolbar.
 *
 * Value is controlled via `value` / `onChange` (HTML in / HTML out). The
 * `onSmartPaste` prop lets callers transform clipboard data before it lands
 * (e.g. Markdown -> HTML, plain-text heading detection).
 */
export function Editor({
  value,
  onChange,
  onSmartPaste,
  placeholder = "Paste your draft or start writing...",
  className,
  minHeight = 500,
}: EditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          rel: "noopener noreferrer",
          target: "_blank",
        },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: "is-editor-empty",
      }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm sm:prose-base dark:prose-invert max-w-none",
          "focus:outline-none",
          "px-6 py-5",
        ),
        spellcheck: "true",
      },
      handlePaste(_view: unknown, event: ClipboardEvent) {
        if (!onSmartPaste) return false;
        const cd = event.clipboardData;
        if (!cd) return false;
        const html = cd.getData("text/html") || undefined;
        const text = cd.getData("text/plain") || undefined;
        if (!html && !text) return false;

        const transformed = onSmartPaste({ html, text });
        if (!transformed) return false;

        event.preventDefault();
        editor?.chain().focus().insertContent(transformed).run();
        return true;
      },
    },
    onUpdate({ editor }: { editor: { getHTML: () => string } }) {
      onChange(editor.getHTML());
    },
  });

  // Keep the editor in sync if the parent resets `value` externally (e.g. Clear button).
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current) {
      editor.commands.setContent(value || "", false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden border border-border bg-card",
        className,
      )}
      style={{ height: `${minHeight}px` }}
    >
      <Toolbar editor={editor} />
      <div className="flex-1 min-h-0 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
