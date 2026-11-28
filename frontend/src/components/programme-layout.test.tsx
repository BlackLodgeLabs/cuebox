import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProgrammeLayout } from "@/components/programme-layout";
import { createQueryWrapper } from "@/test/query-wrapper";
import type { RecommendationDetailResponse } from "@/types/api";

const { getFilmWatchProvidersMock } = vi.hoisted(() => ({
  getFilmWatchProvidersMock: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({
  getFilmWatchProviders: getFilmWatchProvidersMock,
}));

const WITCH_BACKDROP = "https://image.tmdb.org/t/p/w1280/witch-backdrop.jpg";
const WITCH_POSTER = "https://image.tmdb.org/t/p/w500/witch-poster.jpg";
const LAMB_POSTER = "https://image.tmdb.org/t/p/w500/lamb-poster.jpg";

function providers(filmId: string, name: string | null) {
  return {
    film_id: filmId,
    tmdb_id: 1,
    country_code: "GB",
    link: null,
    categories: name
      ? [
          {
            type: "flatrate" as const,
            label: "Stream" as const,
            providers: [
              {
                provider_id: 8,
                provider_name: name,
                logo_url: null,
                display_priority: 1,
              },
            ],
          },
        ]
      : [],
  };
}

function session(
  overrides: Partial<RecommendationDetailResponse> = {},
): RecommendationDetailResponse {
  return {
    session_id: "session-1",
    profile_id: "profile-1",
    profile_cache_hit: false,
    constraint_relaxation: null,
    created_at: "2026-11-14T20:41:00.000Z",
    profile_summary: {
      narrative_profile: "slow, unsettling, under two hours.",
      structured_profile: {},
    },
    winner: {
      film_id: "witch",
      title: "The Witch",
      year: 2015,
      runtime: 92,
      director: "Robert Eggers",
      synopsis: "A family is torn apart by the forces of witchcraft.",
      letterboxd_rating: 4,
      tmdb_rating: 7,
      rotten_tomatoes_score: 91,
      poster_url: WITCH_POSTER,
      backdrop_url: WITCH_BACKDROP,
      genres: ["Folk horror"],
      explanation: {
        why_it_matches:
          "The same folk dread you rated highly in The Wicker Man, in a tighter 92 minutes.",
        why_it_matches_short: null,
        most_influential_factors: ["folk horror"],
        why_it_beat_alternatives: null,
        caveats: null,
      },
    },
    runners_up: [
      {
        film_id: "lamb",
        title: "Lamb",
        year: 2021,
        runtime: 106,
        director: null,
        synopsis: "A childless couple adopt something that isn’t quite a lamb.",
        letterboxd_rating: null,
        tmdb_rating: null,
        rotten_tomatoes_score: null,
        poster_url: LAMB_POSTER,
        backdrop_url: "https://image.tmdb.org/t/p/w1280/lamb-backdrop.jpg",
        genres: ["Folk horror"],
        explanation: {
          why_it_matches: "Unused long explanation.",
          why_it_matches_short: null,
          most_influential_factors: [],
          why_it_beat_alternatives: null,
          caveats: null,
        },
      },
    ],
    ...overrides,
  };
}

describe("ProgrammeLayout fresh pick", () => {
  afterEach(() => {
    cleanup();
    getFilmWatchProvidersMock.mockReset();
  });

  it("shows Tonight's programme, the UK pick time, a backdrop hero, and runners-up", async () => {
    getFilmWatchProvidersMock.mockImplementation((filmId: string) =>
      Promise.resolve(providers(filmId, filmId === "witch" ? "Netflix" : "MUBI")),
    );
    const { Wrapper } = createQueryWrapper();

    render(
      <ProgrammeLayout session={session()} title="Tonight’s programme" />,
      { wrapper: Wrapper },
    );

    const title = screen.getByRole("heading", { level: 1, name: "Tonight’s programme" });
    expect(title).toBeInTheDocument();
    expect(title).toHaveClass("whitespace-nowrap");
    expect(title.className).toContain("text-cb-title");
    expect(screen.getByText("Sat 14 Nov")).toBeInTheDocument();
    expect(
      screen.getByText("From your pick at 20:41 · slow, unsettling, under two hours"),
    ).toBeInTheDocument();

    const hero = screen.getByRole("article", { name: "Your pick" });
    const heroImage = hero.querySelector("img");
    expect(heroImage).toHaveAttribute("src", WITCH_BACKDROP);
    expect(heroImage?.getAttribute("src")).not.toBe(WITCH_POSTER);
    expect(screen.getByRole("heading", { level: 2, name: "The Witch" })).toBeInTheDocument();
    await waitFor(() => {
      expect(hero).toHaveTextContent("2015 · Folk horror · 92m · Netflix");
    });
    expect(
      screen.getByText(
        "The same folk dread you rated highly in The Wicker Man, in a tighter 92 minutes.",
      ),
    ).toBeInTheDocument();

    const view = screen.getByRole("link", { name: "View your pick" });
    expect(view).toHaveAttribute("href", "/watchlist/witch");

    const lamb = screen.getByRole("heading", { level: 3, name: "Lamb" }).closest("li");
    expect(lamb?.querySelector("img")).toHaveAttribute("src", LAMB_POSTER);
    expect(lamb).toHaveTextContent("2021 · Folk horror · 106m");
    expect(lamb).toHaveTextContent("A childless couple adopt something that isn’t quite a lamb.");
    await waitFor(() => {
      expect(lamb).toHaveTextContent("MUBI");
    });
    expect(screen.getByText("Runners-up")).toBeInTheDocument();
  });
});

describe("ProgrammeLayout history night", () => {
  afterEach(() => {
    cleanup();
    getFilmWatchProvidersMock.mockReset();
  });

  it("titles the night with the date and a History back link, without a second date", async () => {
    getFilmWatchProvidersMock.mockResolvedValue(providers("witch", null));
    const { Wrapper } = createQueryWrapper();

    render(
      <ProgrammeLayout
        session={session()}
        title="Sat 14 Nov"
        backLink={{ href: "/history", label: "History" }}
      />,
      { wrapper: Wrapper },
    );

    expect(screen.getByRole("heading", { level: 1, name: "Sat 14 Nov" })).toBeInTheDocument();
    const back = screen.getByRole("link", { name: "Back to History" });
    expect(back).toHaveAttribute("href", "/history");
    expect(back).toHaveTextContent("History");
    expect(screen.getAllByText("Sat 14 Nov")).toHaveLength(1);
    expect(screen.queryByRole("time")).not.toBeInTheDocument();
  });
});

describe("ProgrammeLayout missing fields", () => {
  afterEach(() => {
    cleanup();
    getFilmWatchProvidersMock.mockReset();
  });

  it("omits a missing backdrop, runtime, and provider without stray separators or a poster hero", async () => {
    getFilmWatchProvidersMock.mockImplementation((filmId: string) =>
      Promise.resolve(
        filmId === "witch"
          ? {
              ...providers("witch", null),
              categories: [
                {
                  type: "rent" as const,
                  label: "Rent" as const,
                  providers: [
                    {
                      provider_id: 2,
                      provider_name: "Apple TV",
                      logo_url: null,
                      display_priority: 2,
                    },
                  ],
                },
                {
                  type: "flatrate" as const,
                  label: "Stream" as const,
                  providers: [
                    {
                      provider_id: 8,
                      provider_name: "Netflix",
                      logo_url: null,
                      display_priority: 1,
                    },
                  ],
                },
              ],
            }
          : providers(filmId, null),
      ),
    );
    const { Wrapper } = createQueryWrapper();
    const sparse = session({
      profile_summary: { narrative_profile: "", structured_profile: {} },
      winner: {
        ...session().winner,
        backdrop_url: null,
        year: null,
        runtime: null,
        genres: [],
      },
      runners_up: [
        {
          ...session().runners_up[0],
          poster_url: null,
          synopsis: "   ",
          year: null,
          runtime: null,
          genres: [],
        },
      ],
    });

    render(<ProgrammeLayout session={sparse} title="Tonight’s programme" />, {
      wrapper: Wrapper,
    });

    const hero = screen.getByRole("article", { name: "Your pick" });
    expect(hero.querySelector("img")).toBeNull();
    expect(hero.textContent ?? "").not.toContain(WITCH_POSTER);
    expect(screen.getByText("From your pick at 20:41")).toBeInTheDocument();
    expect(screen.queryByText(/·/)).not.toBeInTheDocument();

    await waitFor(() => {
      expect(hero).toHaveTextContent("Netflix");
    });
    expect(hero.textContent).not.toMatch(/·\s*·/);
    expect(hero.textContent).not.toContain("Apple TV");

    const lamb = screen.getByRole("heading", { level: 3, name: "Lamb" }).closest("li");
    expect(lamb?.querySelector("img")).toBeNull();
    expect(lamb?.textContent ?? "").not.toMatch(/·/);
    expect(lamb?.textContent ?? "").not.toContain("quite a lamb");
  });

  it("drops a backdrop that fails to load instead of leaving a broken image", () => {
    getFilmWatchProvidersMock.mockResolvedValue(providers("witch", null));
    const { Wrapper } = createQueryWrapper();
    render(<ProgrammeLayout session={session()} title="Tonight’s programme" />, {
      wrapper: Wrapper,
    });

    const hero = screen.getByRole("article", { name: "Your pick" });
    const image = hero.querySelector("img");
    expect(image).not.toBeNull();
    fireEvent.error(image!);
    expect(hero.querySelector("img")).toBeNull();
  });

  it("keeps a runner frame when the poster fails to load", () => {
    getFilmWatchProvidersMock.mockResolvedValue(providers("witch", null));
    const { Wrapper } = createQueryWrapper();
    render(<ProgrammeLayout session={session()} title="Tonight’s programme" />, {
      wrapper: Wrapper,
    });

    const lamb = screen.getByRole("heading", { level: 3, name: "Lamb" }).closest("li");
    const image = lamb?.querySelector("img");
    expect(image).not.toBeNull();
    fireEvent.error(image!);
    expect(lamb?.querySelector("img")).toBeNull();
    expect(lamb?.querySelector("[data-still-frame]")).not.toBeNull();
  });
});

function mockReduced(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes("prefers-reduced-motion") ? matches : false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

describe("ProgrammeLayout settle", () => {
  afterEach(() => {
    cleanup();
    getFilmWatchProvidersMock.mockReset();
    delete (window as { matchMedia?: unknown }).matchMedia;
  });

  it("rises 8px with a 70ms stagger and a 300ms ease-out", () => {
    mockReduced(false);
    getFilmWatchProvidersMock.mockResolvedValue(providers("witch", null));
    const { Wrapper } = createQueryWrapper();
    render(<ProgrammeLayout session={session()} title="Tonight’s programme" />, {
      wrapper: Wrapper,
    });

    const items = document.querySelectorAll("[data-settle]");
    expect(items.length).toBeGreaterThanOrEqual(5);
    items.forEach((item, index) => {
      expect(item).toHaveAttribute("data-rise-px", "8");
      expect(item).toHaveAttribute("data-duration-ms", "300");
      expect(item).toHaveAttribute("data-stagger-ms", "70");
      expect(item).toHaveAttribute("data-delay-ms", String(index * 70));
      expect(item).toHaveAttribute("data-travel", "y");
    });
  });

  it("shows the settled layout at once when reduced motion is on", async () => {
    mockReduced(true);
    getFilmWatchProvidersMock.mockResolvedValue(providers("witch", null));
    const { Wrapper } = createQueryWrapper();
    render(<ProgrammeLayout session={session()} title="Tonight’s programme" />, {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      const items = document.querySelectorAll("[data-settle]");
      expect(items.length).toBeGreaterThan(0);
      items.forEach((item) => {
        expect(item).toHaveAttribute("data-travel", "none");
        expect(item).toHaveAttribute("data-rise-px", "0");
        expect(item).toHaveAttribute("data-duration-ms", "0");
        expect(item).toHaveAttribute("data-stagger-ms", "0");
        expect(item).toHaveAttribute("data-delay-ms", "0");
      });
    });
  });
});
