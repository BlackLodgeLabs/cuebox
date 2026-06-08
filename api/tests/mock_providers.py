"""Mock TMDB/OMDb HTTP responses for integration tests."""

from __future__ import annotations

import httpx

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
    }
)


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


def mock_provider_handler(request: httpx.Request, profile: str = "default") -> httpx.Response:
    url = str(request.url)

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
