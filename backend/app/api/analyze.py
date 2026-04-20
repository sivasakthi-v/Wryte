"""Analyze endpoint - returns the scored diagnostic envelope.

Real analyzer pipeline is wired in as each bucket ships:
readability first (live), then structure, intent, search_visibility, trust
(all still stubbed for now).

Until the remaining analyzers land, this endpoint returns realistic-looking
strengths, issues, and formula numbers so the frontend can be built and
reviewed against the real response shape.
"""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter

from app.bucket.readability import analyze_readability
from app.config import settings
from app.schemas import (
    AnalyzeRequest,
    AnalyzeResponse,
    BucketScore,
    EntityCoverage,
    FormulaBreakdown,
    Issue,
    ParsedDocument,
    ParsedSections,
    Strength,
)

router = APIRouter(tags=["analyze"])


# Bucket weights from Plan_v1.md section 5. These match the product spec
# (30/20/20/15/15 = 100) and are locked for V1.
BUCKET_WEIGHTS: dict[str, float] = {
    "intent": 30.0,
    "readability": 20.0,
    "structure": 20.0,
    "search_visibility": 15.0,
    "trust": 15.0,
}


_WORD_RE = re.compile(r"\b[\w']+\b")
_SENTENCE_RE = re.compile(r"[.\!?]+\s|[.\!?]+$")


def _approx_sentence_count(text: str) -> int:
    if not text.strip():
        return 0
    return max(1, len(_SENTENCE_RE.findall(text)))


def _structure_score(doc: ParsedDocument) -> tuple[float, str]:
    """Derive a structure bucket score from the parsed document."""
    score = 0.3
    if doc.has_title:
        score += 0.25
    if doc.has_subheadings:
        score += 0.2
    if doc.has_lists:
        score += 0.15
    if len(doc.paragraphs) >= 2:
        score += 0.1
    score = max(0.0, min(1.0, score))
    if score >= 0.85:
        summary = "Well-structured: title, sub-heads, and lists all present."
    elif score >= 0.6:
        summary = "Good structure - a couple of refinements would help."
    elif score >= 0.4:
        summary = "Basic structure present - add sub-heads and a bulleted list."
    else:
        summary = "Flat wall of text - add a title, sub-heads, and bullets."
    return round(score, 3), summary


def _stub_buckets(doc: ParsedDocument, readability_score: float, readability_summary: str) -> list[BucketScore]:
    """Compose the five bucket scores."""
    structure_score, structure_summary = _structure_score(doc)

    return [
        BucketScore(
            name="intent",
            score=0.5,
            weighted_points=0.5 * BUCKET_WEIGHTS["intent"],
            max_points=BUCKET_WEIGHTS["intent"],
            summary="Intent analyzer not yet wired - showing a neutral placeholder.",
        ),
        BucketScore(
            name="readability",
            score=round(readability_score, 3),
            weighted_points=round(readability_score * BUCKET_WEIGHTS["readability"], 2),
            max_points=BUCKET_WEIGHTS["readability"],
            summary=readability_summary,
        ),
        BucketScore(
            name="structure",
            score=structure_score,
            weighted_points=round(structure_score * BUCKET_WEIGHTS["structure"], 2),
            max_points=BUCKET_WEIGHTS["structure"],
            summary=structure_summary,
        ),
        BucketScore(
            name="search_visibility",
            score=0.5,
            weighted_points=0.5 * BUCKET_WEIGHTS["search_visibility"],
            max_points=BUCKET_WEIGHTS["search_visibility"],
            summary="Search-visibility analyzer not yet wired.",
        ),
        BucketScore(
            name="trust",
            score=0.5,
            weighted_points=0.5 * BUCKET_WEIGHTS["trust"],
            max_points=BUCKET_WEIGHTS["trust"],
            summary="Trust analyzer not yet wired.",
        ),
    ]


def _stub_strengths(doc: ParsedDocument, readability_score: float) -> list[Strength]:
    """Positive signals derived from the parsed document."""
    strengths: list[Strength] = []

    if doc.has_title:
        strengths.append(
            Strength(
                bucket="structure",
                message="Clear title detected at the top of the document.",
                why_it_matters="Titles anchor the reader's attention and give search engines a strong signal.",
            )
        )

    if doc.has_cta:
        strengths.append(
            Strength(
                bucket="intent",
                message="A call-to-action is present.",
                why_it_matters="CTAs tell readers exactly what to do next - conversion goes up when the next step is obvious.",
            )
        )

    if doc.has_subheadings:
        strengths.append(
            Strength(
                bucket="structure",
                message=f"Document uses {len(doc.subheadings)} sub-heading(s) for scanning.",
                why_it_matters="Sub-heads let skimmers find what they care about without reading everything.",
            )
        )

    if doc.has_lists:
        strengths.append(
            Strength(
                bucket="structure",
                message="At least one bulleted or numbered list is present.",
                why_it_matters="Lists reduce visual density and make steps or options easy to compare.",
            )
        )

    if readability_score >= 0.8:
        strengths.append(
            Strength(
                bucket="readability",
                message="Reads at a plain-English level.",
                why_it_matters="Plain-English copy keeps more readers engaged and reaches a broader audience.",
            )
        )

    if not strengths:
        strengths.append(
            Strength(
                bucket="readability",
                message="Content was accepted for analysis.",
                why_it_matters="Real strength signals will appear as each analyzer is wired up.",
            )
        )

    return strengths


def _stub_issues(
    doc: ParsedDocument,
    text: str,
    readability_score: float,
    fkg: float | None,
) -> list[Issue]:
    """Issues derived from the parsed document + readability analyzer."""
    issues: list[Issue] = []

    if not doc.has_title:
        issues.append(
            Issue(
                bucket="structure",
                severity="high",
                message="No title / H1 detected.",
                char_start=0,
                char_end=0,
                suggestion="Add a clear, benefit-led title at the top of the document.",
                why_it_matters="Pages without a primary heading under-perform in search and in reader retention.",
            )
        )

    if not doc.has_cta:
        issues.append(
            Issue(
                bucket="intent",
                severity="high",
                message="No explicit call-to-action found.",
                char_start=max(0, len(text) - 20),
                char_end=len(text),
                suggestion="Close with a concrete next step (e.g., 'Start your free trial').",
                why_it_matters="If the reader doesn't know what to do next, most won't take any action.",
            )
        )

    if not doc.has_subheadings and len(doc.paragraphs) >= 3:
        issues.append(
            Issue(
                bucket="structure",
                severity="med",
                message="No sub-headings - long bodies become hard to scan.",
                char_start=0,
                char_end=min(len(text), 80),
                suggestion="Break the body into 2-4 sections with H2 sub-headings.",
                why_it_matters="Scannability is the #1 predictor of time-on-page for longer content.",
            )
        )

    words = _WORD_RE.findall(text)
    sentence_count = _approx_sentence_count(text)
    if sentence_count and words:
        avg = len(words) / sentence_count
        if avg > 22:
            issues.append(
                Issue(
                    bucket="readability",
                    severity="med",
                    message=f"Average sentence length is long ({avg:.1f} words).",
                    char_start=0,
                    char_end=min(len(text), 80),
                    suggestion="Break the longest sentences into two. Aim for 14-20 words on average.",
                    why_it_matters="Long sentences tire readers and raise the reading-grade level.",
                )
            )

    if fkg is not None and fkg >= 12:
        issues.append(
            Issue(
                bucket="readability",
                severity="high" if fkg >= 14 else "med",
                message=f"Reading grade is high (~{fkg:.0f}).",
                char_start=0,
                char_end=min(len(text), 80),
                suggestion=(
                    "Simplify phrasing and swap long words for shorter ones. "
                    "Target 8th-10th grade for general-audience content."
                ),
                why_it_matters=(
                    "Grade 12+ copy loses most general readers. Shorter sentences "
                    "and plainer vocabulary win attention back."
                ),
            )
        )

    if len(text) < 120:
        issues.append(
            Issue(
                bucket="readability",
                severity="low",
                message="Content is very short - analysis confidence is low.",
                char_start=0,
                char_end=len(text),
                suggestion="Add more body copy so each bucket has enough signal to grade.",
                why_it_matters="Short samples under-sample the underlying formulas and skew the score.",
            )
        )

    if readability_score < 0.4 and sentence_count >= 3:
        issues.append(
            Issue(
                bucket="readability",
                severity="med",
                message="Overall readability is low.",
                char_start=0,
                char_end=min(len(text), 80),
                suggestion=(
                    "Rewrite the two hardest sentences as shorter, active-voice statements. "
                    "Then run it back through."
                ),
                why_it_matters="Readability is the single strongest predictor of how far readers scroll.",
            )
        )

    return issues


def _verdict_for(score: int) -> str:
    if score >= 85:
        return "Strong. A few small polishes and it's ready to publish."
    if score >= 70:
        return "Solid foundation. Address the medium-priority issues and it will fly."
    if score >= 50:
        return "Half-way there. The issues below are the fastest path to a better score."
    return "Needs rework. Start with the high-severity issues at the top of the list."


def _parsed_sections(doc: ParsedDocument) -> ParsedSections:
    return ParsedSections(
        title=doc.title,
        subheadings=list(doc.subheadings),
        paragraphs=list(doc.paragraphs),
        ctas=list(doc.ctas),
        lists=[list(items) for items in doc.lists],
    )


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze(payload: AnalyzeRequest) -> AnalyzeResponse:
    """Analyze the provided document and return a scored response.

    V1 status: readability is real (textstat). Structure is a cheap heuristic
    from the parsed document. Intent / search / trust remain neutral stubs.
    """
    doc = payload.parsed()
    text = doc.as_plain_text()

    # Real readability bucket.
    r = analyze_readability(text)

    buckets = _stub_buckets(doc, r.score, r.summary)
    overall = int(round(sum(b.weighted_points for b in buckets)))

    return AnalyzeResponse(
        id=str(uuid.uuid4()),
        scoring_version=settings.scoring_version,
        created_at=datetime.now(timezone.utc),
        overall_score=overall,
        confidence=0.45,
        verdict=_verdict_for(overall),
        buckets=buckets,
        strengths=_stub_strengths(doc, r.score),
        issues=_stub_issues(doc, text, r.score, r.flesch_kincaid_grade),
        formula_breakdown=FormulaBreakdown(
            flesch_reading_ease=r.flesch_reading_ease,
            flesch_kincaid_grade=r.flesch_kincaid_grade,
            smog_index=r.smog_index,
            gunning_fog=r.gunning_fog,
            coleman_liau=r.coleman_liau,
            automated_readability_index=r.automated_readability_index,
            text_standard=r.text_standard,
            sentence_count=r.sentence_count,
            word_count=r.word_count,
            avg_sentence_length=r.avg_sentence_length,
            long_word_ratio=r.long_word_ratio,
        ),
        entity_coverage=EntityCoverage(),
        parsed_sections=_parsed_sections(doc),
        content_type=payload.content_type,
        focus_keyword=payload.effective_focus_keyword(),
        target_query=payload.target_query,
        inferred_query=None,
    )
