"""Bucket-specific scoring modules.

Each file here computes one of the five scoring buckets from Plan_v1.md
section 5: intent, readability, structure, search_visibility, trust.

Modules are imported by app.api.analyze and composed into the final
AnalyzeResponse. Readability ships first; the rest remain stubbed
inside analyze.py until they land.
"""
