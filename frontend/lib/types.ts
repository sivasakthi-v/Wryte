// Response shapes returned by POST /analyze.
// Mirrors backend/app/schemas.py - keep them in sync manually until we wire up
// OpenAPI-based codegen.

export type Severity = "low" | "med" | "high";

export type BucketName =
  | "intent"
  | "readability"
  | "structure"
  | "search_visibility"
  | "trust";

export type ContentType =
  | "generic"
  | "landing_page"
  | "blog_post"
  | "ad_copy"
  | "email"
  | "social_post"
  | "doc";

export interface BucketScore {
  name: BucketName;
  score: number; // 0..1
  weighted_points: number;
  max_points: number;
  summary: string;
}

export interface Issue {
  bucket: BucketName;
  severity: Severity;
  message: string;
  char_start: number;
  char_end: number;
  suggestion: string | null;
  why_it_matters: string | null;
}

export interface Strength {
  bucket: BucketName;
  message: string;
  char_start: number | null;
  char_end: number | null;
  why_it_matters: string | null;
}

export interface FormulaBreakdown {
  flesch_reading_ease: number | null;
  flesch_kincaid_grade: number | null;
  smog_index: number | null;
  gunning_fog: number | null;
  coleman_liau: number | null;
  automated_readability_index: number | null;
  text_standard: string | null;
  sentence_count: number | null;
  word_count: number | null;
  avg_sentence_length: number | null;
  long_word_ratio: number | null;
}

export interface EntityCoverage {
  found: string[];
  expected_missing: string[];
}

export interface ParsedSections {
  title: string | null;
  subheadings: string[];
  paragraphs: string[];
  ctas: string[];
  lists: string[][];
}

export interface AnalyzeResponse {
  id: string;
  scoring_version: string;
  created_at: string;
  overall_score: number; // 0..100
  confidence: number; // 0..1
  verdict: string;
  buckets: BucketScore[];
  strengths: Strength[];
  issues: Issue[];
  formula_breakdown: FormulaBreakdown;
  entity_coverage: EntityCoverage;
  parsed_sections: ParsedSections;
  content_type: ContentType;
  focus_keyword: string | null;
  target_query: string | null;
  inferred_query: string | null;
}

export interface AnalyzeRequest {
  /** Preferred path: full HTML document emitted by the TipTap editor. */
  document_html?: string;
  /** Legacy plain-text path. */
  text?: string;
  content_type?: ContentType;
  focus_keyword?: string;
  /** Deprecated alias for focus_keyword. */
  target_query?: string;
}
