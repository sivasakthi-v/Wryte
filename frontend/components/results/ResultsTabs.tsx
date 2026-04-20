"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { bucketMeta, severityLabel, severityTone, toneForScore } from "@/lib/buckets";
import type { AnalyzeResponse, BucketScore, Issue, Strength } from "@/lib/types";
import { cn } from "@/lib/utils";

// ---------- Score Meter --------------------------------------------------

function verdictCopy(score: number): { label: string; tone: "success" | "info" | "warning" | "danger" } {
  if (score >= 85) return { label: "Excellent", tone: "success" };
  if (score >= 70) return { label: "Solid", tone: "info" };
  if (score >= 50) return { label: "Needs work", tone: "warning" };
  return { label: "Rewrite recommended", tone: "danger" };
}

const TONE_COLOR: Record<string, string> = {
  success: "hsl(var(--success))",
  info: "hsl(var(--info))",
  warning: "hsl(var(--warning))",
  danger: "hsl(var(--danger))",
  primary: "hsl(var(--primary))",
};

/**
 * Circular SVG score meter. 0..100. Ring color follows the verdict tone so
 * the whole summary reads "at a glance" without needing the number.
 */
function ScoreMeter({ score, confidence, verdict }: { score: number; confidence: number; verdict: string }) {
  const size = 180;
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = circumference * (1 - clamped / 100);
  const v = verdictCopy(score);
  const color = TONE_COLOR[v.tone];

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="hsl(var(--muted))"
            strokeWidth={stroke}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 500ms ease-out" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold text-foreground">{Math.round(clamped)}</span>
          <span className="text-xs uppercase tracking-wide text-muted-foreground">of 100</span>
        </div>
      </div>
      <div className="text-center">
        <div className="text-sm font-semibold" style={{ color }}>
          {v.label}
        </div>
        <p className="mt-1 max-w-[260px] text-xs text-muted-foreground">{verdict}</p>
        <p className="mt-1 text-[11px] text-muted-foreground/80">
          Confidence: {Math.round(confidence * 100)}%
        </p>
      </div>
    </div>
  );
}

// ---------- Bucket row ---------------------------------------------------

function BucketRow({ bucket }: { bucket: BucketScore }) {
  const meta = bucketMeta(bucket.name);
  const pct = Math.round(bucket.score * 100);
  const tone = toneForScore(bucket.score);
  const color = TONE_COLOR[tone];
  return (
    <div className="flex flex-col gap-1.5 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-foreground">{meta.label}</span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {bucket.weighted_points.toFixed(1)} / {bucket.max_points.toFixed(0)}
        </span>
      </div>
      <div className="h-2 overflow-hidden bg-muted">
        <div
          className="h-full transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <p className="text-xs text-muted-foreground">{bucket.summary || meta.description}</p>
    </div>
  );
}

// ---------- Overview pane ------------------------------------------------

function OverviewPane({ result }: { result: AnalyzeResponse }) {
  return (
    <div className="grid gap-6 md:grid-cols-[auto_1fr]">
      <ScoreMeter
        score={result.overall_score}
        confidence={result.confidence}
        verdict={result.verdict}
      />
      <div className="flex flex-col">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Score breakdown
        </h3>
        <div className="mt-2 divide-y divide-border">
          {result.buckets.map((b) => (
            <BucketRow key={b.name} bucket={b} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------- Issues + Fixes pane -----------------------------------------

function AnalysisSummary({ strengths, issues }: { strengths: Strength[]; issues: Issue[] }) {
  const high = issues.filter((i) => i.severity === "high").length;
  const med = issues.filter((i) => i.severity === "med").length;
  const low = issues.filter((i) => i.severity === "low").length;
  return (
    <div className="rounded-none border border-border bg-muted/30 p-4">
      <h4 className="text-sm font-semibold text-foreground">Analysis summary</h4>
      <p className="mt-1 text-sm text-muted-foreground">
        Wryte found <strong className="text-foreground">{strengths.length}</strong> strength
        {strengths.length === 1 ? "" : "s"} and <strong className="text-foreground">{issues.length}</strong>{" "}
        issue{issues.length === 1 ? "" : "s"}
        {issues.length > 0 ? (
          <>
            {" "}
            ({high} high, {med} medium, {low} low).
          </>
        ) : (
          <>.</>
        )}
      </p>
    </div>
  );
}

function ActionPlan({ issues }: { issues: Issue[] }) {
  if (!issues.length) {
    return (
      <div className="rounded-none border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        No issues detected. Rerun the analysis after any edit to confirm.
      </div>
    );
  }
  // High -> medium -> low, preserving original order within each severity.
  const order: Record<Issue["severity"], number> = { high: 0, med: 1, low: 2 };
  const sorted = [...issues].sort((a, b) => order[a.severity] - order[b.severity]);
  return (
    <ol className="space-y-3">
      {sorted.map((issue, i) => {
        const tone = severityTone(issue.severity);
        const meta = bucketMeta(issue.bucket);
        return (
          <li
            key={`${issue.bucket}-${i}`}
            className="rounded-none border border-border bg-card p-4"
          >
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center text-xs font-semibold border border-foreground/20",
                  tone === "danger" && "bg-danger-soft text-danger",
                  tone === "warning" && "bg-warning-soft text-warning",
                  tone === "secondary" && "bg-muted text-muted-foreground",
                )}
              >
                {i + 1}
              </span>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={tone === "danger" ? "danger" : tone === "warning" ? "warning" : "secondary"}>
                    {severityLabel(issue.severity)}
                  </Badge>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    {meta.label}
                  </span>
                </div>
                <p className="mt-1.5 text-sm font-medium text-foreground">{issue.message}</p>
                {issue.suggestion && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Fix:</span> {issue.suggestion}
                  </p>
                )}
                {issue.why_it_matters && (
                  <p className="mt-1 text-xs text-muted-foreground/90">
                    {issue.why_it_matters}
                  </p>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function IssuesPane({ result }: { result: AnalyzeResponse }) {
  return (
    <div className="space-y-4">
      <AnalysisSummary strengths={result.strengths} issues={result.issues} />
      {result.strengths.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Strengths
          </h4>
          <ul className="space-y-1.5">
            {result.strengths.map((s, i) => (
              <li
                key={`${s.bucket}-${i}`}
                className="flex items-start gap-2 rounded-none bg-success-soft/40 px-3 py-2 text-sm"
              >
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
                <span className="flex-1 text-foreground">{s.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Action plan
        </h4>
        <ActionPlan issues={result.issues} />
      </div>
    </div>
  );
}

// ---------- Formula pane ------------------------------------------------

function Stat({ label, value }: { label: string; value: string | number | null | undefined }) {
  const display =
    value === null || value === undefined || value === ""
      ? "-"
      : typeof value === "number"
        ? Number.isFinite(value)
          ? (Math.round(value * 10) / 10).toString()
          : "-"
        : value;
  return (
    <div className="rounded-none border border-border bg-card p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums text-foreground">{display}</div>
    </div>
  );
}

function FormulaPane({ result }: { result: AnalyzeResponse }) {
  const f = result.formula_breakdown;
  return (
    <div className="space-y-4">
      <div>
        <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Readability formulas
        </h4>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <Stat label="Flesch Reading Ease" value={f.flesch_reading_ease} />
          <Stat label="Flesch-Kincaid Grade" value={f.flesch_kincaid_grade} />
          <Stat label="SMOG Index" value={f.smog_index} />
          <Stat label="Gunning Fog" value={f.gunning_fog} />
          <Stat label="Coleman-Liau" value={f.coleman_liau} />
          <Stat label="Automated Readability" value={f.automated_readability_index} />
        </div>
      </div>
      <Separator />
      <div>
        <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Text stats
        </h4>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Words" value={f.word_count} />
          <Stat label="Sentences" value={f.sentence_count} />
          <Stat label="Avg words / sentence" value={f.avg_sentence_length} />
          <Stat label="Long-word ratio" value={f.long_word_ratio} />
        </div>
        {f.text_standard && (
          <p className="mt-3 text-xs text-muted-foreground">
            Consensus reading grade: <strong className="text-foreground">{f.text_standard}</strong>
          </p>
        )}
      </div>
    </div>
  );
}

// ---------- Entities pane -----------------------------------------------

function EntitiesPane({ result }: { result: AnalyzeResponse }) {
  const { found, expected_missing } = result.entity_coverage;
  const hasFocus = Boolean(result.focus_keyword);
  return (
    <div className="space-y-4">
      {!hasFocus && (
        <div className="rounded-none border border-dashed border-border p-4 text-sm text-muted-foreground">
          Tip: set a <strong className="text-foreground">focus keyword</strong> above to check
          entity and keyword coverage.
        </div>
      )}
      <div>
        <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Found in your content
        </h4>
        {found.length ? (
          <div className="flex flex-wrap gap-2">
            {found.map((e) => (
              <Badge key={e} variant="secondary">
                {e}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No entities detected yet.</p>
        )}
      </div>
      <div>
        <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Expected but missing
        </h4>
        {expected_missing.length ? (
          <div className="flex flex-wrap gap-2">
            {expected_missing.map((e) => (
              <Badge key={e} variant="danger">
                {e}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nothing obvious is missing.</p>
        )}
      </div>
    </div>
  );
}

// ---------- Export pane -------------------------------------------------

function ExportPane({ result }: { result: AnalyzeResponse }) {
  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    } catch {
      // Fallback: no-op. Browser without clipboard permissions.
    }
  };
  const handleDownloadJson = () => {
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wryte-${result.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Export the full analysis envelope. JSON matches the <code>/analyze</code> response shape.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleCopyJson}
          className="rounded-none border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted"
        >
          Copy JSON
        </button>
        <button
          type="button"
          onClick={handleDownloadJson}
          className="rounded-none bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Download .json
        </button>
      </div>
      <pre className="max-h-[360px] overflow-auto rounded-none border border-border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
        {JSON.stringify(result, null, 2)}
      </pre>
    </div>
  );
}

// ---------- Container ---------------------------------------------------

export interface ResultsTabsProps {
  result: AnalyzeResponse | null;
  isLoading?: boolean;
  error?: Error | null;
}

function EmptyState() {
  return (
    <div className="flex h-full min-h-[360px] flex-col items-center justify-center gap-2 rounded-none border border-dashed border-border p-8 text-center">
      <div className="text-sm font-medium text-foreground">No analysis yet</div>
      <p className="max-w-[320px] text-xs text-muted-foreground">
        Paste or type your copy on the left, then press <strong>Analyze</strong> to see a full
        diagnostic here.
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex h-full min-h-[360px] flex-col items-center justify-center gap-3 rounded-none border border-border bg-card p-8 text-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <div className="text-sm font-medium text-foreground">Analyzing your content...</div>
      <p className="text-xs text-muted-foreground">
        Scoring across intent, readability, structure, search, and trust.
      </p>
    </div>
  );
}

function ErrorState({ error }: { error: Error }) {
  return (
    <div className="flex h-full min-h-[360px] flex-col items-center justify-center gap-2 rounded-none border border-danger/30 bg-danger-soft/40 p-8 text-center">
      <div className="text-sm font-semibold text-danger">Analysis failed</div>
      <p className="max-w-[380px] text-xs text-muted-foreground">{error.message}</p>
    </div>
  );
}

export function ResultsTabs({ result, isLoading, error }: ResultsTabsProps) {
  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;
  if (!result) return <EmptyState />;

  return (
    <div className="flex flex-col gap-4">
      <Tabs defaultValue="overview" className="flex flex-col gap-4">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="issues">Issues & Fixes</TabsTrigger>
          <TabsTrigger value="formula">Formula</TabsTrigger>
          <TabsTrigger value="entities">Entities</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="focus-visible:outline-none">
          <OverviewPane result={result} />
        </TabsContent>
        <TabsContent value="issues" className="focus-visible:outline-none">
          <IssuesPane result={result} />
        </TabsContent>
        <TabsContent value="formula" className="focus-visible:outline-none">
          <FormulaPane result={result} />
        </TabsContent>
        <TabsContent value="entities" className="focus-visible:outline-none">
          <EntitiesPane result={result} />
        </TabsContent>
        <TabsContent value="export" className="focus-visible:outline-none">
          <ExportPane result={result} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
