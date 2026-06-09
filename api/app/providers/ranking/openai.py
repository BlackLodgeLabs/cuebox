"""OpenAI ranking provider."""

from __future__ import annotations

import json
import logging
import uuid
from typing import Any

import httpx

from app.providers.http_retry import request_with_retry
from app.providers.ranking.base import (
    RankingCandidateInput,
    RankingExplanation,
    RankingProvider,
    RankingResult,
)
from app.prompts.ranking import SYSTEM_PROMPT, build_user_prompt

logger = logging.getLogger(__name__)

_OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions"


class OpenAIRankingProvider(RankingProvider):
    def __init__(
        self,
        client: httpx.AsyncClient,
        api_key: str,
        *,
        model: str,
    ) -> None:
        self._client = client
        self._api_key = api_key
        self._model = model

    async def rank(
        self,
        *,
        profile_narrative: str,
        structured_profile: dict[str, Any],
        candidates: list[RankingCandidateInput],
    ) -> RankingResult:
        payload_candidates = [
            {
                "film_id": str(c.film_id),
                "title": c.title,
                "year": c.year,
                "final_score": c.final_score,
            }
            for c in candidates
        ]
        body = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": build_user_prompt(
                        profile_narrative=profile_narrative,
                        structured_profile=structured_profile,
                        candidates=payload_candidates,
                    ),
                },
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.3,
        }
        response = await request_with_retry(
            self._client,
            "POST",
            _OPENAI_CHAT_URL,
            headers={
                "Authorization": f"Bearer {self._api_key}",
                "Content-Type": "application/json",
            },
            json=body,
        )
        response.raise_for_status()
        result = response.json()
        content = result["choices"][0]["message"]["content"]
        usage = result.get("usage", {})
        return _parse_ranking_json(
            content,
            candidates,
            tokens_input=usage.get("prompt_tokens"),
            tokens_output=usage.get("completion_tokens"),
        )


def _parse_ranking_json(
    raw: str,
    candidates: list[RankingCandidateInput],
    *,
    tokens_input: int | None,
    tokens_output: int | None,
) -> RankingResult:
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid ranking JSON: {exc}") from exc

    candidate_ids = {str(c.film_id) for c in candidates}
    winner_id = uuid.UUID(str(data["winner_film_id"]))
    if str(winner_id) not in candidate_ids:
        winner_id = candidates[0].film_id

    runners_up: list[uuid.UUID] = []
    for item in data.get("runners_up_film_ids", []):
        film_id = uuid.UUID(str(item))
        if (
            str(film_id) in candidate_ids
            and film_id != winner_id
            and film_id not in runners_up
        ):
            runners_up.append(film_id)
        if len(runners_up) >= 4:
            break

    while len(runners_up) < min(4, len(candidates) - 1):
        for candidate in candidates:
            if candidate.film_id != winner_id and candidate.film_id not in runners_up:
                runners_up.append(candidate.film_id)
            if len(runners_up) >= min(4, len(candidates) - 1):
                break
        break

    explanations: dict[str, RankingExplanation] = {}
    raw_explanations = data.get("explanations", {})
    for film_id_str, payload in raw_explanations.items():
        if not isinstance(payload, dict):
            continue
        explanations[film_id_str] = RankingExplanation(
            why_it_matches=str(payload.get("why_it_matches", "")),
            most_influential_factors=list(payload.get("most_influential_factors", []))[:5],
            why_it_beat_alternatives=payload.get("why_it_beat_alternatives"),
            caveats=payload.get("caveats"),
        )

    for candidate in [winner_id, *runners_up]:
        key = str(candidate)
        if key not in explanations:
            explanations[key] = RankingExplanation(
                why_it_matches="Strong match for your stated preferences.",
                most_influential_factors=["semantic fit", "score alignment"],
                why_it_beat_alternatives=(
                    "Highest combined retrieval and scoring signals."
                    if candidate == winner_id
                    else None
                ),
                caveats=None,
            )

    return RankingResult(
        winner_film_id=winner_id,
        runners_up_film_ids=runners_up[:4],
        explanations=explanations,
        tokens_input=tokens_input,
        tokens_output=tokens_output,
    )
