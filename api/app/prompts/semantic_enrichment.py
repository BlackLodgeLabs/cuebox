"""Versioned prompt template for film semantic enrichment."""

from __future__ import annotations

from app.providers.semantic.base import SemanticEnrichmentContext

SEMANTIC_VERSION = "semantic-v1"

SYSTEM_PROMPT = """You are a film analysis assistant. Given film metadata, produce a JSON object with exactly these keys:
- subgenres: array of strings (specific subgenre labels)
- themes: array of strings (thematic elements)
- tones: array of strings (overall tonal qualities)
- visual_descriptors: array of strings (visual/cinematic style)
- emotional_outcomes: array of strings (how viewers may feel after watching)
- viewing_contexts: array of strings (ideal viewing situations)
- complexity: number 0-10 or null (narrative/thematic complexity)
- pacing: number 0-10 or null (narrative pacing)
- energy: number 0-10 or null (intensity/energy level)
- obscurity: number 0-10 or null (how well-known vs niche)
- semantic_summary: string (2-4 sentence summary of the film's semantic identity)

Respond with valid JSON only. All array fields must be JSON arrays of strings. Numeric scores must be between 0 and 10 inclusive or null."""


def build_user_prompt(context: SemanticEnrichmentContext) -> str:
    """Assemble the user prompt from film metadata."""
    lines = [
        f"Title: {context.title}",
    ]
    if context.year is not None:
        lines.append(f"Year: {context.year}")
    if context.director:
        lines.append(f"Director: {context.director}")
    if context.genres:
        lines.append(f"Genres: {', '.join(context.genres)}")
    if context.keywords:
        lines.append(f"Keywords: {', '.join(context.keywords)}")
    if context.synopsis:
        lines.append(f"Synopsis: {context.synopsis}")
    lines.append("")
    lines.append("Produce the semantic profile JSON object.")
    return "\n".join(lines)
