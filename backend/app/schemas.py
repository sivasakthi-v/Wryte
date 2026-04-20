"""Pydantic schemas for the public API.

These define the analysis response contract. They are intentionally complete
even in V1 so the frontend can wire against the real shape - individual bucket
analyzers fill in real values as they ship, but the envelope doesn't change.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

Severity = Literal["low", "med", "high"]
BucketName = Literal["intent", "readability", "structure", "search_visibility", "trust"]

# What kind of content is being analyzed. Drives bucket weighting and the
# wording of suggestions. `generic` is the safe default when the user doesn't
# pick one.
ContentType = Literal[
    "generic",
    "landing_page",
    "blog_post",
    "ad_copy",
    "email",
    "social_post",
    "doc",
]


# -------- Parsed document helper --------------------------------------------


_CTA_VERB = re.compile(
    r"^(?:start|get|try|buy|download|sign up|book|subscribe|join|learn more|"
    r"read more|shop|order|claim|request|contact|schedule|reserve|watch|"
    r"explore|discover|apply|create|build|launch|activate|continue)\b",
    re.IGNORECASE,
)


@dataclass
class ParsedDocument:
    """Structured view of a document - used to drive strengths / issues.

    Populated from either raw HTML (`document_html` via BeautifulSoup) or a
    plain-text `text` blob (simple line-based heuristics). Either way the
    downstream analyzer only looks at this structure.
    """

    title: str | None = None
    subheadings: list[str] = field(default_factory=list)
    paragraphs: list[str] = field(default_factory=list)
    ctas: list[str] = field(default_factory=list)
    lists: list[list[str]] = field(default_factory=list)

    @property
    def has_title(self) -> bool:
        return bool(self.title and self.title.strip())

    @property
    def has_cta(self) -> bool:
        return any(c.strip() for c in self.ctas)

    @property
    def has_subheadings(self) -> bool:
        return bool(self.subheadings)

    @property
    def has_lists(self) -> bool:
        return bool(self.lists)

    def as_plain_text(self) -> str:
        """Reconstruct a plain-text view of the document for formula analysis."""
        pieces: list[str] = []
        if self.title:
            pieces.append(self.title.strip())
        for sub in self.subheadings:
            sub = sub.strip()
            if sub:
                pieces.append(sub)
        for para in self.paragraphs:
            para = para.strip()
            if para:
                pieces.append(para)
        for bullets in self.lists:
            for item in bullets:
                item = item.strip()
                if item:
                    pieces.append(item)
        for cta in self.ctas:
            cta = cta.strip()
            if cta:
                pieces.append(cta)
        return "\n\n".join(pieces)


def _looks_like_cta(text: str) -> bool:
    """Deterministic CTA heuristic: verb-led, short, no trailing period."""
    text = (text or "").strip()
    if not text or len(text) > 70:
        return False
    if text.endswith("."):
        return False
    return bool(_CTA_VERB.search(text))


def parse_html_document(html: str) -> ParsedDocument:
    """Parse TipTap/editor HTML into a ParsedDocument using BeautifulSoup."""
    from bs4 import BeautifulSoup  # local import: keep top-level import cost down

    soup = BeautifulSoup(html or "", "html.parser")
    doc = ParsedDocument()

    h1 = soup.find("h1")
    if h1:
        doc.title = h1.get_text(" ", strip=True)

    for tag in soup.find_all(["h2", "h3"]):
        sub = tag.get_text(" ", strip=True)
        if sub:
            doc.subheadings.append(sub)

    for p in soup.find_all("p"):
        txt = p.get_text(" ", strip=True)
        if not txt:
            continue
        # A <p> whose only child is an <a class="wryte-cta"> (or that looks like a CTA)
        # counts as a CTA, not a paragraph.
        anchor = p.find("a")
        if anchor is not None and "wryte-cta" in (anchor.get("class") or []):
            doc.ctas.append(anchor.get_text(" ", strip=True))
            continue
        if _looks_like_cta(txt):
            doc.ctas.append(txt)
            continue
        doc.paragraphs.append(txt)

    for list_tag in soup.find_all(["ul", "ol"]):
        items = [li.get_text(" ", strip=True) for li in list_tag.find_all("li", recursive=False)]
        items = [i for i in items if i]
        if items:
            doc.lists.append(items)

    # Buttons / explicit CTA anchors outside <p>.
    for extra in soup.find_all(["button", "a"]):
        if extra.find_parent("p") is not None:
            continue
        txt = extra.get_text(" ", strip=True)
        if txt and (_looks_like_cta(txt) or "wryte-cta" in (extra.get("class") or [])):
            doc.ctas.append(txt)

    return doc


def parse_plain_text(text: str) -> ParsedDocument:
    """Light-touch fallback parser for the raw `text` compatibility path."""
    doc = ParsedDocument()
    blocks = [b.strip() for b in re.split(r"\n\s*\n", text or "") if b.strip()]
    if not blocks:
        return doc

    first = blocks[0]
    if len(first) <= 80 and not first.endswith("."):
        doc.title = first
        blocks = blocks[1:]

    for block in blocks:
        single_line = "\n" not in block
        if _looks_like_cta(block) and single_line:
            doc.ctas.append(block)
        elif single_line and len(block) <= 70 and block == block.title():
            doc.subheadings.append(block)
        else:
            doc.paragraphs.append(block)
    return doc


# -------- Request --------------------------------------------------------


class AnalyzeRequest(BaseModel):
    """Input to POST /analyze.

    Preferred path is `document_html` - a full HTML document produced by the
    TipTap editor. The legacy `text` field (plain paste) is still accepted
    for backward compatibility and CLI-style usage. Exactly one of the two
    must be provided.
    """

    document_html: str | None = Field(
        default=None,
        max_length=100_000,
        description="Full document as HTML (preferred path, emitted by the TipTap editor).",
    )

    # Legacy raw-paste path.
    text: str | None = Field(
        default=None,
        max_length=50_000,
        description="Plain-text content. Used only when document_html is absent.",
    )

    content_type: ContentType = Field(
        default="generic",
        description="What kind of content this is - drives bucket weighting.",
    )
    focus_keyword: str | None = Field(
        default=None,
        max_length=200,
        description="Primary query / keyword the content should rank for.",
    )

    # Back-compat: target_query is an older alias for focus_keyword.
    target_query: str | None = Field(
        default=None,
        max_length=500,
        description="Deprecated alias for focus_keyword.",
    )

    @model_validator(mode="after")
    def _require_some_input(self) -> "AnalyzeRequest":
        chunks = [self.document_html, self.text]
        if not any(chunk and chunk.strip() for chunk in chunks):
            raise ValueError("At least one of document_html or text must be non-empty.")
        return self

    def effective_focus_keyword(self) -> str | None:
        return self.focus_keyword or self.target_query

    def parsed(self) -> ParsedDocument:
        """Return the ParsedDocument for whichever input path was used."""
        if self.document_html and self.document_html.strip():
            return parse_html_document(self.document_html)
        return parse_plain_text((self.text or "").strip())

    def resolved_text(self) -> str:
        """Return the full analyzable body for readability + formula work."""
        return self.parsed().as_plain_text()


# -------- Response ------------------------------------------------------


class BucketScore(BaseModel):
    """Per-bucket score breakdown."""

    name: BucketName
    score: float = Field(..., ge=0.0, le=1.0, description="Raw bucket score in [0, 1].")
    weighted_points: float = Field(..., ge=0.0, description="Score multiplied by bucket weight.")
    max_points: float = Field(..., ge=0.0, description="Maximum points for this bucket.")
    summary: str = Field(..., description="One-line plain-language summary for this bucket.")


class Issue(BaseModel):
    """A single problem identified in the text, with its location."""

    bucket: BucketName
    severity: Severity
    message: str = Field(..., description="Short human-readable problem description.")
    char_start: int = Field(..., ge=0)
    char_end: int = Field(..., ge=0)
    suggestion: str | None = Field(default=None, description="Concrete fix suggestion, if any.")
    why_it_matters: str | None = Field(
        default=None, description="Short explanation of why this hurts the content."
    )


class Strength(BaseModel):
    """A single thing the content is doing well."""

    bucket: BucketName
    message: str = Field(..., description="Short human-readable strength description.")
    char_start: int | None = Field(default=None, ge=0)
    char_end: int | None = Field(default=None, ge=0)
    why_it_matters: str | None = Field(
        default=None, description="Short explanation of why this helps the content."
    )


class ParsedSections(BaseModel):
    """Structured view of what was parsed out of the document.

    The frontend echoes these back in the 'Input' tab so the user can verify
    Wryte is seeing the sections the way they intend.
    """

    title: str | None = None
    subheadings: list[str] = Field(default_factory=list)
    paragraphs: list[str] = Field(default_factory=list)
    ctas: list[str] = Field(default_factory=list)
    lists: list[list[str]] = Field(default_factory=list)


class FormulaBreakdown(BaseModel):
    """Raw readability formula outputs. Shown in the 'About the score' panel."""

    flesch_reading_ease: float | None = None
    flesch_kincaid_grade: float | None = None
    smog_index: float | None = None
    gunning_fog: float | None = None
    coleman_liau: float | None = None
    automated_readability_index: float | None = None
    text_standard: str | None = None
    sentence_count: int | None = None
    word_count: int | None = None
    avg_sentence_length: float | None = None
    long_word_ratio: float | None = None


class EntityCoverage(BaseModel):
    """Entities found in the text vs. entities expected from the target query."""

    found: list[str] = Field(default_factory=list)
    expected_missing: list[str] = Field(default_factory=list)


class AnalyzeResponse(BaseModel):
    """Full analysis envelope returned by POST /analyze."""

    id: str
    scoring_version: str
    created_at: datetime

    overall_score: int = Field(..., ge=0, le=100)
    confidence: float = Field(..., ge=0.0, le=1.0)
    verdict: str

    buckets: list[BucketScore]
    strengths: list[Strength] = Field(default_factory=list)
    issues: list[Issue] = Field(default_factory=list)
    formula_breakdown: FormulaBreakdown = Field(default_factory=FormulaBreakdown)
    entity_coverage: EntityCoverage = Field(default_factory=EntityCoverage)
    parsed_sections: ParsedSections = Field(default_factory=ParsedSections)

    content_type: ContentType = "generic"
    focus_keyword: str | None = None
    target_query: str | None = None  # echoed back when client sent it
    inferred_query: str | None = None
