"""OpenAI chat-completions semantic enrichment provider."""

from __future__ import annotations

import json
import logging

import httpx

from app.providers.http_retry import request_with_retry
from app.providers.semantic.base import (
    SemanticEnrichmentContext,
    SemanticEnrichmentProvider,
    SemanticProfileResult,
)
from app.prompts.semantic_enrichment import SYSTEM_PROMPT, build_user_prompt

logger = logging.getLogger(__name__)

_OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions"


class OpenAISemanticProvider(SemanticEnrichmentProvider):
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

    async def enrich(self, context: SemanticEnrichmentContext) -> SemanticProfileResult:
        payload = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": build_user_prompt(context)},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.2,
        }
        response = await request_with_retry(
            self._client,
            "POST",
            _OPENAI_CHAT_URL,
            headers={
                "Authorization": f"Bearer {self._api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        response.raise_for_status()
        body = response.json()
        content = body["choices"][0]["message"]["content"]
        return _parse_profile_json(content)


class SemanticParseError(ValueError):
    """Raised when LLM output cannot be parsed into a semantic profile."""


def _parse_profile_json(raw: str) -> SemanticProfileResult:
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise SemanticParseError(f"Invalid JSON from semantic provider: {exc}") from exc

    if not isinstance(data, dict):
        raise SemanticParseError("Semantic provider response must be a JSON object")

    def _str_list(key: str) -> list[str]:
        value = data.get(key, [])
        if value is None:
            return []
        if not isinstance(value, list) or not all(isinstance(item, str) for item in value):
            raise SemanticParseError(f"{key} must be an array of strings")
        return value

    def _score(key: str) -> float | None:
        value = data.get(key)
        if value is None:
            return None
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise SemanticParseError(f"{key} must be a number or null")
        score = float(value)
        if score < 0 or score > 10:
            raise SemanticParseError(f"{key} must be between 0 and 10")
        return score

    summary = data.get("semantic_summary")
    if summary is not None and not isinstance(summary, str):
        raise SemanticParseError("semantic_summary must be a string or null")

    return SemanticProfileResult(
        subgenres=_str_list("subgenres"),
        themes=_str_list("themes"),
        tones=_str_list("tones"),
        visual_descriptors=_str_list("visual_descriptors"),
        emotional_outcomes=_str_list("emotional_outcomes"),
        viewing_contexts=_str_list("viewing_contexts"),
        complexity=_score("complexity"),
        pacing=_score("pacing"),
        energy=_score("energy"),
        obscurity=_score("obscurity"),
        semantic_summary=summary,
    )
