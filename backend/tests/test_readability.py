"""Tests for the readability bucket."""

from __future__ import annotations

import pytest

from app.bucket.readability import (
    HAS_TEXTSTAT,
    ReadabilityResult,
    analyze_readability,
)


PLAIN_ENGLISH = (
    "The cat sat on the mat. The dog ran past the house. "
    "Birds sang in the tree. Children played in the park. "
    "It was a bright, sunny afternoon and the town felt alive. "
    "Neighbours waved from their porches and shared stories with the kids. "
    "The baker sold warm bread and fresh pies at the corner shop. "
    "Everyone stopped to talk about the weather and the week ahead. "
    "A small band played simple songs by the fountain in the square. "
    "The afternoon light faded slowly and the crowd began to thin out."
)

DIFFICULT = (
    "The epistemological ramifications of phenomenological hermeneutics, "
    "particularly when juxtaposed against positivist methodologies, "
    "engender a multifaceted discursive framework wherein interpretive "
    "paradigms must be rigorously contextualised within socio-historical "
    "particularities. Consequently, researchers must navigate an increasingly "
    "convoluted terrain of methodological triangulation."
)


def test_result_shape_is_stable() -> None:
    r = analyze_readability(PLAIN_ENGLISH)
    assert isinstance(r, ReadabilityResult)
    assert 0.0 <= r.score <= 1.0
    assert isinstance(r.summary, str)
    assert r.sentence_count is not None and r.sentence_count >= 2
    assert r.word_count is not None and r.word_count >= 20


@pytest.mark.skipif(not HAS_TEXTSTAT, reason="textstat not installed in this environment")
def test_plain_english_scores_high() -> None:
    r = analyze_readability(PLAIN_ENGLISH)
    assert r.flesch_reading_ease is not None
    # Plain English should land comfortably above 60.
    assert r.flesch_reading_ease > 60
    # Score should reflect that (>= 0.7 is "plain English or better").
    assert r.score >= 0.7


@pytest.mark.skipif(not HAS_TEXTSTAT, reason="textstat not installed in this environment")
def test_difficult_text_scores_lower() -> None:
    easy = analyze_readability(PLAIN_ENGLISH)
    hard = analyze_readability(DIFFICULT)
    # Grade level should be higher for the academic passage.
    assert hard.flesch_kincaid_grade is not None
    assert easy.flesch_kincaid_grade is not None
    assert hard.flesch_kincaid_grade > easy.flesch_kincaid_grade
    # And the overall bucket score should drop.
    assert hard.score < easy.score


def test_short_text_returns_low_confidence_result() -> None:
    r = analyze_readability("Too short.")
    # With <20 words we intentionally skip the formulas.
    assert r.flesch_reading_ease is None
    assert r.flesch_kincaid_grade is None
    assert r.summary.startswith("Not enough text")
