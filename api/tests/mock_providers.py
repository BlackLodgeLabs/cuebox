"""Mock TMDB/OMDb/OpenAI HTTP responses for integration tests."""

from __future__ import annotations

import json

import httpx

from app.providers.embedding.base import EMBEDDING_DIMENSION

MATRIX_TMDB_ID = 603
AMBIGUOUS_TMDB_ID = 11622
DUPLICATE_TMDB_ID = 77777
EMPTY_GB_TMDB_ID = 99999
WATCH_PROVIDER_FAIL_TMDB_ID = 88888

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


def _watch_providers_json(tmdb_id: int) -> dict:
    if tmdb_id == WATCH_PROVIDER_FAIL_TMDB_ID:
        raise ValueError("handled as HTTP 500 in mock_provider_handler")
    if tmdb_id == EMPTY_GB_TMDB_ID:
        return {
            "id": tmdb_id,
            "results": {
                "GB": {
                    "link": f"https://www.themoviedb.org/movie/{tmdb_id}/watch?locale=GB",
                    "flatrate": [],
                    "rent": [],
                    "buy": [],
                    "ads": [],
                }
            },
        }
    return {
        "id": tmdb_id,
        "results": {
            "GB": {
                "link": f"https://www.themoviedb.org/movie/{tmdb_id}/watch?locale=GB",
                "flatrate": [
                    {
                        "provider_id": 8,
                        "provider_name": "Netflix",
                        "logo_path": "/t/p/netflix.jpg",
                        "display_priority": 1,
                    },
                    {
                        "provider_id": 337,
                        "provider_name": "Disney Plus",
                        "logo_path": "/t/p/disney.jpg",
                        "display_priority": 2,
                    },
                ],
                "rent": [
                    {
                        "provider_id": 2,
                        "provider_name": "Apple TV",
                        "logo_path": "/t/p/apple.jpg",
                        "display_priority": 3,
                    },
                ],
                "buy": [
                    {
                        "provider_id": 3,
                        "provider_name": "Google Play Movies",
                        "logo_path": "/t/p/google.jpg",
                        "display_priority": 4,
                    },
                ],
                "ads": [
                    {
                        "provider_id": 1796,
                        "provider_name": "Netflix Standard with Ads",
                        "logo_path": "/t/p/netflix-ads.jpg",
                        "display_priority": 5,
                    },
                ],
            }
        },
    }


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
        "poster_path": "/poster.jpg",
    }


def _paginated_search_response(page: int) -> httpx.Response:
    page_one = [
        _search_result(1000 + i, f"Film {i}", release_date="2000-01-01") for i in range(20)
    ]
    page_two = [
        _search_result(1020 + i, f"Film {20 + i}", release_date="2000-01-01") for i in range(5)
    ]
    current_page = max(1, page)
    if current_page <= 1:
        results = page_one
    elif current_page == 2:
        results = page_two
    else:
        results = []
    return httpx.Response(
        200,
        json={
            "page": current_page,
            "total_pages": 2,
            "total_results": 25,
            "results": results,
        },
    )


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
    if query == "Possession":
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


def _default_ranking_response() -> dict:
    return {
        "winner_film_id": "00000000-0000-0000-0000-000000000001",
        "runners_up_film_ids": [
            "00000000-0000-0000-0000-000000000002",
            "00000000-0000-0000-0000-000000000003",
            "00000000-0000-0000-0000-000000000004",
            "00000000-0000-0000-0000-000000000005",
        ],
        "explanations": {
            "00000000-0000-0000-0000-000000000001": {
                "why_it_matches": "Strong thematic and tonal alignment with your profile.",
                "most_influential_factors": ["theme fit", "pacing"],
                "why_it_beat_alternatives": "Highest combined semantic and scoring signals.",
                "caveats": None,
            },
            "00000000-0000-0000-0000-000000000002": {
                "why_it_matches": "Close runner-up with similar mood.",
                "most_influential_factors": ["emotional fit"],
                "why_it_beat_alternatives": None,
                "caveats": None,
            },
        },
    }


def _openai_chat_response(profile: str, request: httpx.Request | None = None) -> httpx.Response:
    if profile == "semantic_failure":
        return httpx.Response(500, json={"error": {"message": "Semantic provider error"}})
    if profile == "malformed_semantic_json":
        content = "not valid json"
    elif request is not None and _is_ranking_request(request):
        content = json.dumps(_build_ranking_response_from_request(request))
    else:
        content = json.dumps(DEFAULT_SEMANTIC_PROFILE)
    return httpx.Response(
        200,
        json={
            "choices": [{"message": {"content": content}}],
            "usage": {"prompt_tokens": 120, "completion_tokens": 80},
        },
    )


def _is_ranking_request(request: httpx.Request) -> bool:
    try:
        body = json.loads(request.content.decode())
        messages = body.get("messages", [])
        system = messages[0]["content"] if messages else ""
        return "film recommendation assistant" in system.lower()
    except (json.JSONDecodeError, KeyError, IndexError, AttributeError):
        return False


def _build_ranking_response_from_request(request: httpx.Request) -> dict:
    try:
        body = json.loads(request.content.decode())
        user_content = body["messages"][1]["content"]
    except (json.JSONDecodeError, KeyError, IndexError):
        return _default_ranking_response()

    candidate_ids: list[str] = []
    for line in user_content.splitlines():
        line = line.strip()
        if line.startswith("- ") and ":" in line:
            film_id = line.split(":", 1)[0].replace("- ", "").strip()
            candidate_ids.append(film_id)

    if not candidate_ids:
        return _default_ranking_response()

    winner = candidate_ids[0]
    runners = candidate_ids[1:5]
    explanations = {
        winner: {
            "why_it_matches": "Strong thematic and tonal alignment with your profile.",
            "most_influential_factors": ["theme fit", "pacing"],
            "why_it_beat_alternatives": "Highest combined semantic and scoring signals.",
            "caveats": None,
        }
    }
    for film_id in runners:
        explanations[film_id] = {
            "why_it_matches": "Solid alternative with overlapping themes.",
            "most_influential_factors": ["semantic fit"],
            "why_it_beat_alternatives": None,
            "caveats": None,
        }
    return {
        "winner_film_id": winner,
        "runners_up_film_ids": runners,
        "explanations": explanations,
    }


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
        return _openai_chat_response(profile, request)

    if "/v1/embeddings" in url:
        if "voyageai.com" in url:
            return _voyage_embedding_response(profile)
        return _openai_embedding_response(profile)

    if "/api/chat" in url:
        return _ollama_chat_response(profile)

    if "/search/movie" in url:
        query = request.url.params.get("query", "")
        if query == "Paginated":
            page = int(request.url.params.get("page", "1"))
            return _paginated_search_response(page)
        return _default_search_response(query)

    if "/watch/providers" in url:
        if profile == "partial_http_failure":
            return httpx.Response(500, json={"status_message": "Server error"})
        for tmdb_id in (
            MATRIX_TMDB_ID,
            AMBIGUOUS_TMDB_ID,
            DUPLICATE_TMDB_ID,
            EMPTY_GB_TMDB_ID,
            WATCH_PROVIDER_FAIL_TMDB_ID,
        ):
            if f"/movie/{tmdb_id}/watch/providers" in url:
                if tmdb_id == WATCH_PROVIDER_FAIL_TMDB_ID:
                    return httpx.Response(500, json={"status_message": "Server error"})
                return httpx.Response(200, json=_watch_providers_json(tmdb_id))
        # Generic watch/providers for seeded films (10000+)
        parts = url.split("/movie/")
        if len(parts) > 1:
            tmdb_id_str = parts[1].split("/")[0]
            if tmdb_id_str.isdigit():
                return httpx.Response(200, json=_watch_providers_json(int(tmdb_id_str)))

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
