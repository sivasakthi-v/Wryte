"use client";

import {
  Bold,
  Eraser,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Undo2,
  Redo2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

// TipTap ships its d.ts files but our bundler occasionally cannot resolve
// the `Editor` class export; we model the subset we use here so the rest
// of the app stays type-safe regardless of upstream type wobble.
interface ChainCommand {
  focus: () => ChainCommand;
  toggleHeading: (opts: { level: 1 | 2 | 3 }) => ChainCommand;
  toggleBold: () => ChainCommand;
  toggleItalic: () => ChainCommand;
  toggleBulletList: () => ChainCommand;
  toggleOrderedList: () => ChainCommand;
  clearNodes: () => ChainCommand;
  unsetAllMarks: () => ChainCommand;
  extendMarkRange: (name: string) => ChainCommand;
  setLink: (attrs: { href: string }) => ChainCommand;
  unsetLink: () => ChainCommand;
  undo: () => ChainCommand;
  redo: () => ChainCommand;
  run: () => boolean;
}

interface CanCommand {
  undo: () => boolean;
  redo: () => boolean;
}

export interface ToolbarEditor {
  chain: () => ChainCommand;
  can: () => CanCommand;
  isActive: (name: string, attrs?: Record<string, unknown>) => boolean;
  getAttributes: (name: string) => Record<string, unknown>;
}

/**
 * Sticky rich-text toolbar mounted above the TipTap editor.
 *
 * All actions run against the TipTap command chain - none mutate state
 * outside the editor, so React state stays in sync automatically.
 */
export function Toolbar({ editor }: { editor: ToolbarEditor | null }) {
  if (!editor) return null;

  const btn = (
    active: boolean,
    onClick: () => void,
    title: string,
    Icon: React.ComponentType<{ className?: string }>,
    disabled = false,
  ) => (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-none text-sm transition-colors",
        "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active && "bg-muted text-foreground",
        !active && "text-muted-foreground",
        disabled && "pointer-events-none opacity-40",
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );

  const promptForLink = () => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL", previous || "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  return (
    <div className="sticky top-0 z-10 flex items-center gap-1 border-b border-border bg-card/95 px-2 py-1.5 backdrop-blur">
      {btn(
        editor.isActive("heading", { level: 1 }),
        () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
        "Heading 1",
        Heading1,
      )}
      {btn(
        editor.isActive("heading", { level: 2 }),
        () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
        "Heading 2",
        Heading2,
      )}
      {btn(
        editor.isActive("heading", { level: 3 }),
        () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
        "Heading 3",
        Heading3,
      )}
      <Separator orientation="vertical" className="mx-1 h-5" />
      {btn(
        editor.isActive("bold"),
        () => editor.chain().focus().toggleBold().run(),
        "Bold",
        Bold,
      )}
      {btn(
        editor.isActive("italic"),
        () => editor.chain().focus().toggleItalic().run(),
        "Italic",
        Italic,
      )}
      <Separator orientation="vertical" className="mx-1 h-5" />
      {btn(
        editor.isActive("bulletList"),
        () => editor.chain().focus().toggleBulletList().run(),
        "Bulleted list",
        List,
      )}
      {btn(
        editor.isActive("orderedList"),
        () => editor.chain().focus().toggleOrderedList().run(),
        "Numbered list",
        ListOrdered,
      )}
      <Separator orientation="vertical" className="mx-1 h-5" />
      {btn(editor.isActive("link"), promptForLink, "Link", LinkIcon)}
      {btn(false, () => editor.chain().focus().clearNodes().unsetAllMarks().run(), "Clear formatting", Eraser)}
      <Separator orientation="vertical" className="mx-1 h-5" />
      {btn(
        false,
        () => editor.chain().focus().undo().run(),
        "Undo",
        Undo2,
        !editor.can().undo(),
      )}
      {btn(
        false,
        () => editor.chain().focus().redo().run(),
        "Redo",
        Redo2,
        !editor.can().redo(),
      )}
    </div>
  );
}
