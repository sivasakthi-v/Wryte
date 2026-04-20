// Shared metadata for the five scoring buckets.
// Kept separate from the types module so both server- and client-side code
// can import display strings without pulling in React.

import type { BucketName, Severity } from "@/lib/types";

export interface BucketMeta {
  name: BucketName;
  label: string;
  weight: number; // Max points this bucket contributes to the 100.
  /** Short pitch shown in the bucket card and in info tooltips. */
  description: string;
  /** Semantic tone used to color the progress bar and accents. */
  tone: "primary" | "success" | "warning" | "danger" | "info";
  /** Long-form explanation shown inside the info tooltip on the bucket label. */
  longDescription: string;
}

export const BUCKETS: BucketMeta[] = [
  {
    name: "intent",
    label: "Intent",
    weight: 30,
    tone: "primary",
    description: "Does the content match the reader's goal?",
    longDescription:
      "Scores how well the copy addresses the target query / job-to-be-done. High intent scores come from an explicit answer up top, a clear value proposition, and a matching call-to-action.",
  },
  {
    name: "readability",
    label: "Readability",
    weight: 20,
    tone: "info",
    description: "How easy is the text to read?",
    longDescription:
      "Blends Flesch Reading Ease, Flesch-Kincaid, SMOG, and other formulas with passive-voice and jargon detection. High scores mean short sentences, plain words, and a low reading grade.",
  },
  {
    name: "structure",
    label: "Structure",
    weight: 20,
    tone: "success",
    description: "Is the content scannable?",
    longDescription:
      "Rewards meaningful headings, paragraph length, lists, and logical flow. Pages that read as a wall of text score low here.",
  },
  {
    name: "search_visibility",
    label: "Search visibility",
    weight: 15,
    tone: "warning",
    description: "Will search engines surface it?",
    longDescription:
      "Tracks title tag strength, heading hierarchy, keyword coverage, meta-description signals, and entity presence. Not a rank predictor — a health check.",
  },
  {
    name: "trust",
    label: "Trust",
    weight: 15,
    tone: "danger",
    description: "Does it feel credible?",
    longDescription:
      "Looks for hedging language, unsubstantiated claims, spelling and grammar, and hype indicators. Clean, confident copy scores higher.",
  },
];

const BUCKET_BY_NAME: Record<BucketName, BucketMeta> = Object.fromEntries(
  BUCKETS.map((b) => [b.name, b]),
) as Record<BucketName, BucketMeta>;

export function bucketMeta(name: BucketName): BucketMeta {
  return BUCKET_BY_NAME[name];
}

/** Map a 0..1 score to a semantic tone. Thresholds match Plan_v1.md. */
export function toneForScore(score: number): BucketMeta["tone"] {
  if (score >= 0.85) return "success";
  if (score >= 0.7) return "info";
  if (score >= 0.5) return "warning";
  return "danger";
}

/** Display label for severity. */
export function severityLabel(severity: Severity): string {
  switch (severity) {
    case "high":
      return "High";
    case "med":
      return "Medium";
    case "low":
      return "Low";
  }
}

/** Badge tone for severity. */
export function severityTone(severity: Severity): "danger" | "warning" | "secondary" {
  switch (severity) {
    case "high":
      return "danger";
    case "med":
      return "warning";
    case "low":
      return "secondary";
  }
}
