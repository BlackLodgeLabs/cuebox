"""Unit tests for embedding input composition."""

from app.services.embedding_service import compose_embedding_input


def test_compose_embedding_input_includes_all_fields():
    text = compose_embedding_input(
        synopsis="A hacker learns the truth.",
        genres=["Action", "Sci-Fi"],
        keywords=["simulation"],
        semantic_summary="Mind-bending cyberpunk.",
        themes=["reality", "choice"],
    )
    assert "Synopsis: A hacker learns the truth." in text
    assert "Genres: Action, Sci-Fi" in text
    assert "Keywords: simulation" in text
    assert "Summary: Mind-bending cyberpunk." in text
    assert "Themes: reality, choice" in text


def test_compose_embedding_input_fallback_when_empty():
    assert compose_embedding_input(
        synopsis=None,
        genres=[],
        keywords=[],
        semantic_summary=None,
    ) == "Film"
