import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ShortReasons } from "@/components/ceremony/ceremony-shared";
import type { FilmResult } from "@/types/api";

function filmWithExplanation(
  explanation: FilmResult["explanation"],
): FilmResult {
  return {
    film_id: "film-1",
    title: "Test Film",
    year: 1999,
    runtime: 100,
    director: "Director",
    synopsis: "Full synopsis should never appear in ShortReasons.",
    letterboxd_rating: 4,
    tmdb_rating: 7,
    rotten_tomatoes_score: 80,
    poster_url: null,
    explanation,
  };
}

describe("ShortReasons", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows short why and factors when short is present", () => {
    render(
      <ShortReasons
        film={filmWithExplanation({
          why_it_matches: "Full multi-sentence rationale that must stay hidden.",
          why_it_matches_short: "Phone-friendly why.",
          most_influential_factors: ["theme fit", "mood"],
          why_it_beat_alternatives: "Beat alternatives.",
          caveats: "A caveat.",
        })}
      />,
    );

    expect(screen.getByTestId("short-reasons")).toBeInTheDocument();
    expect(screen.getByText("theme fit")).toBeInTheDocument();
    expect(screen.getByText("Phone-friendly why.")).toBeInTheDocument();
    expect(
      screen.queryByText("Full multi-sentence rationale that must stay hidden."),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Beat alternatives.")).not.toBeInTheDocument();
    expect(screen.queryByText("A caveat.")).not.toBeInTheDocument();
  });

  it("omits why section when short is missing (factors only)", () => {
    render(
      <ShortReasons
        film={filmWithExplanation({
          why_it_matches: "Legacy full why must not appear.",
          most_influential_factors: ["semantic fit"],
          why_it_beat_alternatives: null,
          caveats: null,
        })}
      />,
    );

    expect(screen.getByText("semantic fit")).toBeInTheDocument();
    expect(screen.queryByText("Why it matches")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Legacy full why must not appear."),
    ).not.toBeInTheDocument();
  });

  it("omits why section when short is blank", () => {
    render(
      <ShortReasons
        film={filmWithExplanation({
          why_it_matches: "Full why still omitted.",
          why_it_matches_short: "   ",
          most_influential_factors: ["runtime fit"],
          why_it_beat_alternatives: null,
          caveats: null,
        })}
      />,
    );

    expect(screen.getByText("runtime fit")).toBeInTheDocument();
    expect(screen.queryByText("Why it matches")).not.toBeInTheDocument();
    expect(screen.queryByText("Full why still omitted.")).not.toBeInTheDocument();
  });
});
