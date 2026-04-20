"""Smoke tests for the skeleton endpoints."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_ok() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_root_exposes_metadata() -> None:
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "name" in data
    assert "version" in data
    assert "scoring_version" in data


def test_analyze_returns_envelope() -> None:
    response = client.post("/analyze", json={"text": "Hello world. This is a test."})
    assert response.status_code == 200
    data = response.json()

    # Envelope shape should be stable even while analyzers are stubs.
    assert isinstance(data["id"], str)
    assert 0 <= data["overall_score"] <= 100
    assert 0.0 <= data["confidence"] <= 1.0
    assert isinstance(data["verdict"], str)

    bucket_names = {b["name"] for b in data["buckets"]}
    assert bucket_names == {"intent", "readability", "structure", "search_visibility", "trust"}

    # Weights should sum to exactly 100.
    total_max = sum(b["max_points"] for b in data["buckets"])
    assert total_max == 100.0

    # V2 envelope additions.
    assert isinstance(data["strengths"], list)
    assert data["content_type"] == "generic"
    assert "parsed_sections" in data


def test_analyze_accepts_document_html() -> None:
    """Preferred input path: TipTap-style HTML document."""
    html = (
        "<h1>Ship faster with Wryte</h1>"
        "<h2>Why it works</h2>"
        "<p>Paste your copy. We grade it across five buckets. "
        "You get a 100-point score and concrete fixes.</p>"
        "<ul><li>Readability</li><li>Structure</li><li>Intent</li></ul>"
        '<p><a class="wryte-cta" href="#">Start your free analysis</a></p>'
    )
    response = client.post(
        "/analyze",
        json={
            "document_html": html,
            "content_type": "landing_page",
            "focus_keyword": "content scoring tool",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["content_type"] == "landing_page"
    assert data["focus_keyword"] == "content scoring tool"

    sections = data["parsed_sections"]
    assert sections["title"] == "Ship faster with Wryte"
    assert "Why it works" in sections["subheadings"]
    assert any("Start your free analysis" in c for c in sections["ctas"])
    assert sections["lists"], "Expected at least one list to be parsed"

    # Strengths should cover title + CTA now that sections were detected.
    messages = " ".join(s["message"].lower() for s in data["strengths"])
    assert "title" in messages
    assert "call-to-action" in messages


def test_analyze_accepts_legacy_text_field() -> None:
    """Back-compat: raw text path still works."""
    response = client.post(
        "/analyze",
        json={"text": "A simple title\n\nThis is some body copy. " * 5},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["parsed_sections"]["title"] == "A simple title"


def test_analyze_rejects_empty_payload() -> None:
    response = client.post("/analyze", json={})
    assert response.status_code == 422


def test_analyze_rejects_whitespace_only() -> None:
    response = client.post("/analyze", json={"text": "   \n\n  "})
    assert response.status_code == 422


def test_target_query_is_accepted_as_alias_for_focus_keyword() -> None:
    response = client.post(
        "/analyze",
        json={"text": "Some body. Another sentence.", "target_query": "legacy alias"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["focus_keyword"] == "legacy alias"
    assert data["target_query"] == "legacy alias"
