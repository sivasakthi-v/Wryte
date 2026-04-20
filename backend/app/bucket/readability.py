"""Readability bucket — the first real scoring module.

Uses textstat to compute the six classic readability formulas and maps
Flesch Reading Ease onto a normalized [0, 1] bucket score. The endpoint
still returns a live response when textstat isn't installed (we fall back
to cheap word/sentence heuristics), so the envelope shape never breaks.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# textstat is an optional import. It's listed in pyproject.toml so production
# builds always have it, but the module degrades gracefully when it's missing
# (e.g. during the very first `uv sync` or on a fresh checkout).
try:
    import textstat as _textstat  # type: ignore[import-not-found]

    HAS_TEXTSTAT = True
except Exception:  # pragma: no cover - defensive fallback
    _textstat = None
    HAS_TEXTSTAT = False


_WORD_RE = re.compile(r"\b[\w']+\b")
_SENTENCE_RE = re.compile(r"[.\!?]+\s|[.\!?]+$")


@dataclass
class ReadabilityResult:
    """Everything the API needs to render the readability bucket + formula tab."""

    # Bucket score in [0, 1] plus a short plain-language summary.
    score: float
    summary: str

    # Raw formula outputs — filled when textstat is available, else None.
    flesch_reading_ease: float | None
    flesch_kincaid_grade: float | None
    smog_index: float | None
    gunning_fog: float | None
    coleman_liau: float | None
    automated_readability_index: float | None
    text_standard: str | None

    # Low-level counts (useful for the Formula tab even without textstat).
    sentence_count: int | None
    word_count: int | None
    avg_sentence_length: float | None
    long_word_ratio: float | None


def _approx_sentence_count(text: str) -> int:
    if not text.strip():
        return 0
    return max(1, len(_SENTENCE_RE.findall(text)))


def _round(value: float | None, digits: int = 2) -> float | None:
    """Round to `digits`, preserving None."""
    if value is None:
        return None
    try:
        return round(float(value), digits)
    except (TypeError, ValueError):
        return None


def _summary_from_flesch(fre: float | None, fkg: float | None) -> str:
    """Produce a plain-language readability summary.

    Flesch Reading Ease scale (the classic one):
      90-100  -> 5th grade, very easy
      80-89   -> 6th grade, easy
      70-79   -> 7th grade, fairly easy
      60-69   -> 8th/9th grade, plain English
      50-59   -> 10th-12th grade, fairly difficult
      30-49   -> college, difficult
      0-29    -> college grad, very difficult
    """
    if fre is None:
        return "Could not compute a readability score — give me a few full sentences."
    grade = f" (grade-level ~{fkg:.0f})" if fkg is not None else ""
    if fre >= 70:
        return f"Easy to read{grade}. Most readers will get through this without effort."
    if fre >= 60:
        return f"Plain English{grade}. Comfortable for a general audience."
    if fre >= 50:
        return f"Slightly difficult{grade}. Works for a knowledgeable reader."
    if fre >= 30:
        return f"Difficult{grade}. Tighten sentences and swap a few complex words."
    return f"Very difficult{grade}. Shorter sentences and simpler vocabulary are urgent."


def _score_from_flesch(fre: float | None, word_count: int) -> float:
    """Map Flesch Reading Ease onto a [0, 1] bucket score.

    We target "plain English" (FRE ~ 65) as the sweet spot = 1.0. The score
    falls off on both sides:
      - Very difficult (FRE < 30) bottoms out at 0.15.
      - Overly simple (FRE > 95) also drops, since children's-book copy
        on a landing page reads as patronising.

    With very little content the formula is unreliable, so we cap the score
    at 0.6 until the user gives us at least ~60 words.
    """
    if fre is None:
        # Rough textstat-free fallback so the bucket still moves.
        return 0.5

    # Piecewise mapping, anchored at FRE=65 = 1.0.
    if fre >= 60:
        # 60..100 -> 1.0 -> 0.7 (too easy starts to penalise gently)
        score = 1.0 - max(0.0, fre - 75) / 100
    elif fre >= 50:
        score = 0.75  # plain-English borderline
    elif fre >= 30:
        score = 0.45 + (fre - 30) * (0.25 / 20)  # 30..50 -> 0.45..0.70
    else:
        score = max(0.15, 0.15 + fre * 0.01)  # <30 -> floor at 0.15

    # Short content penalty.
    if word_count < 60:
        score = min(score, 0.6)

    return max(0.0, min(1.0, round(score, 3)))


def analyze_readability(text: str) -> ReadabilityResult:
    """Compute the readability bucket for a block of text."""
    text = text or ""
    word_count = len(_WORD_RE.findall(text))
    sentence_count = _approx_sentence_count(text)
    avg_sentence_length = (word_count / sentence_count) if sentence_count else 0.0
    long_word_ratio = (
        sum(1 for w in _WORD_RE.findall(text) if len(w) >= 7) / word_count
        if word_count
        else 0.0
    )

    # If we don't have enough text to be meaningful, short-circuit with Nones
    # so the frontend can render em-dashes for the formula cells rather than
    # a misleading "infinite" grade level from textstat.
    too_short = word_count < 20 or sentence_count < 2

    fre: float | None = None
    fkg: float | None = None
    smog: float | None = None
    fog: float | None = None
    cli: float | None = None
    ari: float | None = None
    standard: str | None = None

    if HAS_TEXTSTAT and not too_short and _textstat is not None:
        try:
            fre = _round(_textstat.flesch_reading_ease(text))
            fkg = _round(_textstat.flesch_kincaid_grade(text))
            smog = _round(_textstat.smog_index(text))
            fog = _round(_textstat.gunning_fog(text))
            cli = _round(_textstat.coleman_liau_index(text))
            ari = _round(_textstat.automated_readability_index(text))
            standard = _textstat.text_standard(text, float_output=False)
        except Exception:  # pragma: no cover - textstat can throw on pathological input
            # Leave the formula values as None; we'll still return count-based signals.
            pass

    score = _score_from_flesch(fre, word_count)
    summary = _summary_from_flesch(fre, fkg) if not too_short else (
        "Not enough text to grade readability — add a few more full sentences."
    )

    return ReadabilityResult(
        score=score,
        summary=summary,
        flesch_reading_ease=fre,
        flesch_kincaid_grade=fkg,
        smog_index=smog,
        gunning_fog=fog,
        coleman_liau=cli,
        automated_readability_index=ari,
        text_standard=standard,
        sentence_count=sentence_count or None,
        word_count=word_count or None,
        avg_sentence_length=_round(avg_sentence_length, 2) if avg_sentence_length else None,
        long_word_ratio=_round(long_word_ratio, 3) if long_word_ratio else None,
    )
