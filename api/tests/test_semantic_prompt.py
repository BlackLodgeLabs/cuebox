"""Unit tests for semantic enrichment prompt assembly."""

from app.prompts.semantic_enrichment import SEMANTIC_VERSION, build_user_prompt
from app.providers.semantic.base import SemanticEnrichmentContext


def test_prompt_includes_title_synopsis_genres():
    context = SemanticEnrichmentContext(
        title="The Matrix",
        year=1999,
        synopsis="A hacker discovers reality is simulated.",
        genres=["Action", "Science Fiction"],
        keywords=["artificial reality"],
        director="Lana Wachowski",
    )
    prompt = build_user_prompt(context)
    assert "The Matrix" in prompt
    assert "1999" in prompt
    assert "A hacker discovers" in prompt
    assert "Action" in prompt
    assert "artificial reality" in prompt
    assert "Lana Wachowski" in prompt


def test_semantic_version_is_semantic_v1():
    assert SEMANTIC_VERSION == "semantic-v1"
