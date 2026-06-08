"""Mock TMDB/OMDb/OpenAI HTTP responses for integration tests."""

from __future__ import annotations

import json

import httpx

from app.providers.embedding.base import EMBEDDING_DIMENSION

MATRIX_TMDB_ID = 603
AMBIGUOUS_TMDB_ID = 11622
DUPLICATE_TMDB_ID = 77777

ADVERSARIAL_PROFILES = frozenset(
    {
        "default",
        "runtime_zero",
        "malformed_date",
        "vote_zero",
        "partial_http_failure",
        "duplicate_tmdb_id",
        "semantic_failure",
        "embedding_failure",
        "malformed_semantic_json",
    }
)

DEFAULT_SEMANTIC_PROFILE = {
    "subgenres": ["cyberpunk", "martial arts"],
    "themes": ["reality vs illusion", "free will"],
    "tones": ["dark", "philosophical"],
    "visual_descriptors": ["green-tinted digital rain", "slow-motion action"],
    "emotional_outcomes": ["mind-blown", "contemplative"],
    "viewing_contexts": ["late night", "with friends"],
    "complexity": 8.5,
    "pacing": 7.0,
    "energy": 8.0,
    "obscurity": 2.0,
    "semantic_summary": (
        "A mind-bending sci-fi action film exploring simulated reality and human agency."
    ),
}


def mock_embedding_vector(seed: str = "default") -> list[float]:
    """Deterministic 1536-dimensional vector for pgvector inserts."""
    base = sum(ord(c) for c in seed) % 97
    return [round(((base + (i % 17)) * 0.001), 6) for i in range(EMBEDDING_DIMENSION)]


def _movie_json(
    tmdb_id: int,
    title: str,
    *,
    year: str = "1999",
    imdb_id: str = "tt0133093",
    original_title: str | None = None,
    runtime: int | None = 136,
    release_date: str | None = None,
    vote_average: float | None = 8.7,
) -> dict:
    return {
        "id": tmdb_id,
        "imdb_id": imdb_id,
        "title": title,
        "original_title": original_title or title,
        "release_date": release_date or f"{year}-03-31",
        "runtime": runtime,
        "overview": "A computer hacker learns about the true nature of reality.",
        "genres": [{"id": 1, "name": "Action"}, {"id": 2, "name": "Science Fiction"}],
        "original_language": "en",
        "production_countries": [{"iso_3166_1": "US", "name": "United States"}],
        "vote_average": vote_average,
        "poster_path": "/poster.jpg",
        "backdrop_path": "/backdrop.jpg",
    }


def _search_result(tmdb_id: int, title: str, *, release_date: str) -> dict:
    return {
        "id": tmdb_id,
        "title": title,
        "original_title": title,
        "release_date": release_date,
        "overview": f"Overview for {title}.",
    }


def _default_search_response(query: str) -> httpx.Response:
    if query == "Unknown Film":
        return httpx.Response(200, json={"results": []})
    if query == "Ambiguous Title":
        return httpx.Response(
            200,
            json={
                "results": [
                    _search_result(AMBIGUOUS_TMDB_ID, "Possession", release_date="1981-05-27")
                ]
            },
        )
    if query == "Partial Fail":
        return httpx.Response(
            200,
            json={"results": [_search_result(MATRIX_TMDB_ID, "Partial Fail", release_date="2001-01-01")]},
        )
    if query in {"Dup Film A", "Dup Film B"}:
        return httpx.Response(
            200,
            json={
                "results": [
                    _search_result(DUPLICATE_TMDB_ID, query, release_date="2000-01-01"),
                ]
            },
        )
    return httpx.Response(
        200,
        json={
            "results": [
                _search_result(MATRIX_TMDB_ID, "The Matrix", release_date="1999-03-31"),
            ]
        },
    )


def _movie_details_json(tmdb_id: int, profile: str) -> dict:
    if profile == "runtime_zero":
        return _movie_json(tmdb_id, "The Matrix", runtime=0)
    if profile == "malformed_date":
        return _movie_json(tmdb_id, "The Matrix", release_date="TBD")
    if profile == "vote_zero":
        return _movie_json(tmdb_id, "The Matrix", vote_average=0.0)
    if tmdb_id == DUPLICATE_TMDB_ID:
        title = "Dup Film A"
        return _movie_json(
            DUPLICATE_TMDB_ID,
            title,
            year="2000",
            imdb_id="tt0000777",
            original_title=title,
        )
    if tmdb_id == AMBIGUOUS_TMDB_ID:
        return _movie_json(
            AMBIGUOUS_TMDB_ID,
            "Possession",
            year="1981",
            imdb_id="tt0081505",
            original_title="Possession",
        )
    return _movie_json(tmdb_id, "The Matrix")


def _openai_chat_response(profile: str) -> httpx.Response:
    if profile == "semantic_failure":
        return httpx.Response(500, json={"error": {"message": "Semantic provider error"}})
    if profile == "malformed_semantic_json":
        content = "not valid json"
    else:
        content = json.dumps(DEFAULT_SEMANTIC_PROFILE)
    return httpx.Response(
        200,
        json={
            "choices": [{"message": {"content": content}}],
        },
    )


def _openai_embedding_response(profile: str) -> httpx.Response:
    if profile == "embedding_failure":
        return httpx.Response(500, json={"error": {"message": "Embedding provider error"}})
    return httpx.Response(
        200,
        json={
            "data": [{"embedding": mock_embedding_vector(profile)}],
        },
    )


def _ollama_chat_response(profile: str) -> httpx.Response:
    if profile == "semantic_failure":
        return httpx.Response(500, json={"error": "Ollama error"})
    if profile == "malformed_semantic_json":
        content = "not valid json"
    else:
        content = json.dumps(DEFAULT_SEMANTIC_PROFILE)
    return httpx.Response(
        200,
        json={"message": {"content": content}},
    )


def _voyage_embedding_response(profile: str) -> httpx.Response:
    if profile == "embedding_failure":
        return httpx.Response(500, json={"error": {"message": "Voyage provider error"}})
    return httpx.Response(
        200,
        json={
            "data": [{"embedding": mock_embedding_vector(f"voyage-{profile}")}],
        },
    )


def mock_provider_handler(request: httpx.Request, profile: str = "default") -> httpx.Response:
    url = str(request.url)

    if "/v1/chat/completions" in url:
        return _openai_chat_response(profile)

    if "/v1/embeddings" in url:
        if "voyageai.com" in url:
            return _voyage_embedding_response(profile)
        return _openai_embedding_response(profile)

    if "/api/chat" in url:
        return _ollama_chat_response(profile)

    if "/search/movie" in url:
        query = request.url.params.get("query", "")
        return _default_search_response(query)

    if profile == "partial_http_failure":
        if "/movie/" in url and "/keywords" not in url and "/credits" not in url:
            return httpx.Response(500, json={"status_message": "Server error"})
        if "/keywords" in url or "/credits" in url:
            return httpx.Response(500, json={"status_message": "Server error"})

    if f"/movie/{MATRIX_TMDB_ID}/keywords" in url:
        return httpx.Response(200, json={"keywords": [{"id": 1, "name": "artificial reality"}]})

    if f"/movie/{AMBIGUOUS_TMDB_ID}/keywords" in url:
        return httpx.Response(200, json={"keywords": [{"id": 2, "name": "horror"}]})

    if f"/movie/{DUPLICATE_TMDB_ID}/keywords" in url:
        return httpx.Response(200, json={"keywords": [{"id": 3, "name": "duplicate"}]})

    if f"/movie/{MATRIX_TMDB_ID}/credits" in url:
        return httpx.Response(
            200,
            json={"crew": [{"name": "Lana Wachowski", "job": "Director"}]},
        )

    if f"/movie/{AMBIGUOUS_TMDB_ID}/credits" in url:
        return httpx.Response(
            200,
            json={"crew": [{"name": "Andrzej Żuławski", "job": "Director"}]},
        )

    if f"/movie/{DUPLICATE_TMDB_ID}/credits" in url:
        return httpx.Response(
            200,
            json={"crew": [{"name": "Test Director", "job": "Director"}]},
        )

    for tmdb_id in (MATRIX_TMDB_ID, AMBIGUOUS_TMDB_ID, DUPLICATE_TMDB_ID):
        if f"/movie/{tmdb_id}" in url and "/keywords" not in url and "/credits" not in url:
            return httpx.Response(200, json=_movie_details_json(tmdb_id, profile))

    if "omdbapi.com" in url:
        return httpx.Response(
            200,
            json={
                "Response": "True",
                "Ratings": [{"Source": "Rotten Tomatoes", "Value": "88%"}],
            },
        )

    return httpx.Response(404, json={"status_message": f"Unhandled mock URL: {url}"})


def create_mock_http_client(profile: str = "default") -> httpx.AsyncClient:
    if profile not in ADVERSARIAL_PROFILES:
        raise ValueError(f"Unknown mock profile: {profile}")
    return httpx.AsyncClient(
        transport=httpx.MockTransport(lambda request: mock_provider_handler(request, profile))
    )
