"use client";

import { create } from "zustand";
import type { ContentType } from "@/lib/types";

/**
 * Editor + form state shared between the left (editor) pane and the right
 * (results tabs) pane. Kept deliberately small - actual analysis responses
 * live in React Query's cache, not here.
 */
export interface EditorState {
  documentHtml: string;
  focusKeyword: string;
  contentType: ContentType;
  setDocumentHtml: (html: string) => void;
  setFocusKeyword: (kw: string) => void;
  setContentType: (ct: ContentType) => void;
  reset: () => void;
}

const EMPTY_DOC = "";

export const useEditorStore = create<EditorState>((set) => ({
  documentHtml: EMPTY_DOC,
  focusKeyword: "",
  contentType: "generic",
  setDocumentHtml: (documentHtml) => set({ documentHtml }),
  setFocusKeyword: (focusKeyword) => set({ focusKeyword }),
  setContentType: (contentType) => set({ contentType }),
  reset: () =>
    set({
      documentHtml: EMPTY_DOC,
      focusKeyword: "",
      contentType: "generic",
    }),
}));
