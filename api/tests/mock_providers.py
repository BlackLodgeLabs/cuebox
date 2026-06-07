"""Mock TMDB/OMDb HTTP responses for integration tests."""

from __future__ import annotations

import httpx

MATRIX_TMDB_ID = 603
AMBIGUOUS_TMDB_ID = 11622


def _movie_json(
    tmdb_id: int,
    title: str,
    *,
    year: str = "1999",
    imdb_id: str = "tt0133093",
    original_title: str | None = None,
) -> dict:
    return {
        "id": tmdb_id,
        "imdb_id": imdb_id,
        "title": title,
        "original_title": original_title or title,
        "release_date": f"{year}-03-31",
        "runtime": 136,
        "overview": "A computer hacker learns about the true nature of reality.",
        "genres": [{"id": 1, "name": "Action"}, {"id": 2, "name": "Science Fiction"}],
        "original_language": "en",
        "production_countries": [{"iso_3166_1": "US", "name": "United States"}],
        "vote_average": 8.7,
        "poster_path": "/poster.jpg",
        "backdrop_path": "/backdrop.jpg",
    }


def mock_provider_handler(request: httpx.Request) -> httpx.Response:
    url = str(request.url)

    if "/search/movie" in url:
        query = request.url.params.get("query", "")
        if query == "Unknown Film":
            return httpx.Response(200, json={"results": []})
        if query == "Ambiguous Title":
            return httpx.Response(
                200,
                json={
                    "results": [
                        {
                            "id": AMBIGUOUS_TMDB_ID,
                            "title": "Possession",
                            "original_title": "Possession",
                            "release_date": "1981-05-27",
                            "overview": "A different film entirely.",
                        }
                    ]
                },
            )
        return httpx.Response(
            200,
            json={
                "results": [
                    {
                        "id": MATRIX_TMDB_ID,
                        "title": "The Matrix",
                        "original_title": "The Matrix",
                        "release_date": "1999-03-31",
                        "overview": "A computer hacker learns about the true nature of reality.",
                    }
                ]
            },
        )

    if f"/movie/{MATRIX_TMDB_ID}/keywords" in url:
        return httpx.Response(200, json={"keywords": [{"id": 1, "name": "artificial reality"}]})

    if f"/movie/{AMBIGUOUS_TMDB_ID}/keywords" in url:
        return httpx.Response(200, json={"keywords": [{"id": 2, "name": "horror"}]})

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

    if f"/movie/{MATRIX_TMDB_ID}" in url and "/keywords" not in url and "/credits" not in url:
        return httpx.Response(200, json=_movie_json(MATRIX_TMDB_ID, "The Matrix"))

    if f"/movie/{AMBIGUOUS_TMDB_ID}" in url and "/keywords" not in url and "/credits" not in url:
        return httpx.Response(
            200,
            json=_movie_json(
                AMBIGUOUS_TMDB_ID,
                "Possession",
                year="1981",
                imdb_id="tt0081505",
                original_title="Possession",
            ),
        )

    if "omdbapi.com" in url:
        return httpx.Response(
            200,
            json={
                "Response": "True",
                "Ratings": [{"Source": "Rotten Tomatoes", "Value": "88%"}],
            },
        )

    return httpx.Response(404, json={"status_message": f"Unhandled mock URL: {url}"})


def create_mock_http_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.MockTransport(mock_provider_handler))
