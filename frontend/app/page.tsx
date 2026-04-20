"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { BarChart3, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Editor } from "@/components/editor/Editor";
import { ContentTypeSelect } from "@/components/input/ContentTypeSelect";
import { FocusKeywordInput } from "@/components/input/FocusKeywordInput";
import { ResultsTabs } from "@/components/results/ResultsTabs";
import { ThemeToggle } from "@/components/ThemeToggle";

import { useEditorStore } from "@/lib/editorStore";
import { smartPasteHtml } from "@/lib/smartPasteHtml";
import { analyze, ApiError } from "@/lib/api";
import type { AnalyzeRequest, AnalyzeResponse } from "@/lib/types";

function stripHtmlToText(html: string): string {
  if (typeof window === "undefined") return "";
  const doc = new DOMParser().parseFromString(html || "", "text/html");
  return (doc.body.textContent || "").trim();
}

export default function DashboardPage() {
  const documentHtml = useEditorStore((s) => s.documentHtml);
  const focusKeyword = useEditorStore((s) => s.focusKeyword);
  const contentType = useEditorStore((s) => s.contentType);
  const setDocumentHtml = useEditorStore((s) => s.setDocumentHtml);
  const setFocusKeyword = useEditorStore((s) => s.setFocusKeyword);
  const setContentType = useEditorStore((s) => s.setContentType);
  const resetStore = useEditorStore((s) => s.reset);

  const mutation = useMutation<AnalyzeResponse, ApiError, AnalyzeRequest>({
    mutationFn: analyze,
  });

  const plainText = React.useMemo(() => stripHtmlToText(documentHtml), [documentHtml]);
  const hasContent = plainText.length > 0;
  const canSubmit = hasContent && !mutation.isPending;

  const handleAnalyze = () => {
    if (!canSubmit) return;
    const payload: AnalyzeRequest = {
      document_html: documentHtml,
      content_type: contentType,
      focus_keyword: focusKeyword.trim() || undefined,
    };
    mutation.mutate(payload);
  };

  const handleClear = () => {
    resetStore();
    mutation.reset();
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-none bg-primary/10 text-primary">
              <BarChart3 className="h-4 w-4" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold">Wryte</span>
              <span className="text-xs text-muted-foreground">
                Content Intelligence Dashboard
              </span>
            </div>
            <Badge variant="outline" className="ml-2 text-[10px]">
              V1
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground md:block">
              Paste text. Get a diagnostic score. Fix what matters.
            </span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6 lg:py-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          {/* Left: content editor */}
          <section className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
              <ContentTypeSelect value={contentType} onChange={setContentType} />
              <FocusKeywordInput value={focusKeyword} onChange={setFocusKeyword} />
            </div>
            <Editor
              value={documentHtml}
              onChange={setDocumentHtml}
              onSmartPaste={smartPasteHtml}
              minHeight={520}
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {hasContent
                  ? `${plainText.split(/\s+/).filter(Boolean).length} words ready to analyze.`
                  : "Paste or type your draft above."}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClear}
                  disabled={!hasContent && !mutation.data}
                  className="inline-flex items-center gap-1.5 rounded-none border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Clear
                </button>
                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={!canSubmit}
                  className="inline-flex items-center rounded-none bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
                >
                  {mutation.isPending ? "Analyzing..." : "Analyze"}
                </button>
              </div>
            </div>
          </section>

          {/* Right: results */}
          <section className="flex flex-col">
            <ResultsTabs
              result={mutation.data ?? null}
              isLoading={mutation.isPending}
              error={mutation.isError ? (mutation.error as Error) : null}
            />
          </section>
        </div>
      </main>
    </div>
  );
}
