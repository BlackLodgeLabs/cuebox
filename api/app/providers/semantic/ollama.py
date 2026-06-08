"""Ollama HTTP API semantic enrichment provider."""

from __future__ import annotations

import json

import httpx

from app.providers.http_retry import request_with_retry
from app.providers.semantic.base import (
    SemanticEnrichmentContext,
    SemanticEnrichmentProvider,
    SemanticProfileResult,
)
from app.providers.semantic.openai import _parse_profile_json
from app.prompts.semantic_enrichment import SYSTEM_PROMPT, build_user_prompt


class OllamaSemanticProvider(SemanticEnrichmentProvider):
    def __init__(
        self,
        client: httpx.AsyncClient,
        base_url: str,
        *,
        model: str,
    ) -> None:
        self._client = client
        self._base_url = base_url.rstrip("/")
        self._model = model

    async def enrich(self, context: SemanticEnrichmentContext) -> SemanticProfileResult:
        payload = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": build_user_prompt(context)},
            ],
            "stream": False,
            "format": "json",
        }
        response = await request_with_retry(
            self._client,
            "POST",
            f"{self._base_url}/api/chat",
            json=payload,
        )
        response.raise_for_status()
        body = response.json()
        content = body["message"]["content"]
        if isinstance(content, dict):
            return _parse_profile_json(json.dumps(content))
        return _parse_profile_json(str(content))
