"""Versioned ranking prompt for recommendation Stage 6."""

PROMPT_VERSION = "recommendation-v1"

SYSTEM_PROMPT = """You are a film recommendation assistant. Given a viewer profile and scored candidates,
select one winner and up to four runners-up. Return JSON with:
{
  "winner_film_id": "uuid",
  "runners_up_film_ids": ["uuid", ...],
  "explanations": {
    "<film_id>": {
      "why_it_matches": "string",
      "most_influential_factors": ["factor1", "factor2"],
      "why_it_beat_alternatives": "string or null",
      "caveats": "string or null"
    }
  }
}
Only use film IDs from the candidate list. Winner must include why_it_beat_alternatives."""


def build_user_prompt(
    *,
    profile_narrative: str,
    structured_profile: dict,
    candidates: list[dict],
) -> str:
    lines = [
        f"Profile: {profile_narrative}",
        f"Structured preferences: {structured_profile}",
        "Candidates:",
    ]
    for candidate in candidates:
        lines.append(
            f"- {candidate['film_id']}: {candidate['title']} ({candidate.get('year')}) "
            f"final_score={candidate.get('final_score')}"
        )
    return "\n".join(lines)
