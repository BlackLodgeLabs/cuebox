import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RecommendationCeremony } from "@/components/recommendation-ceremony";
import {
  __resetCeremonyGatesForTests,
  armCeremonyGate,
  isCeremonyArmed,
} from "@/lib/ceremony-gate";
import type { RecommendationResponse } from "@/types/api";

const pushMock = vi.fn();
const replaceMock = vi.fn();
let searchParams = new URLSearchParams("stage=1");
let pathname = "/recommend/results/session-1";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
  usePathname: () => pathname,
  useSearchParams: () => searchParams,
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
    "aria-label": ariaLabel,
    "data-testid": dataTestId,
    ...rest
  }: {
    children?: React.ReactNode;
    href: string;
    className?: string;
    "aria-label"?: string;
    "data-testid"?: string;
  }) => (
    <a
      href={href}
      className={className}
      aria-label={ariaLabel}
      data-testid={dataTestId}
      {...rest}
    >
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <div>{alt}</div>,
}));

vi.mock("@/components/film-poster", () => ({
  FilmPoster: ({ alt }: { alt: string }) => <div>{alt}</div>,
}));

const { useFilmsWatchProvidersMock } = vi.hoisted(() => ({
  useFilmsWatchProvidersMock: vi.fn(() => new Map()),
}));

vi.mock("@/hooks/use-watch-providers", () => ({
  useFilmsWatchProviders: useFilmsWatchProvidersMock,
}));

const recommendation: RecommendationResponse & {
  profile_summary?: {
    narrative_profile: string;
    structured_profile: Record<string, unknown>;
  };
} = {
  session_id: "session-1",
  profile_id: "profile-1",
  profile_cache_hit: false,
  constraint_relaxation: null,
  created_at: "2024-01-01T00:00:00Z",
  profile_summary: {
    narrative_profile: "You want slow-burn horror.",
    structured_profile: { genres: ["Horror"] },
  },
  winner: {
    film_id: "winner-1",
    title: "Winner Film",
    year: 1999,
    runtime: 110,
    director: "Director One",
    synopsis: "A haunting tale of isolation.",
    letterboxd_rating: 4.1,
    tmdb_rating: 7.8,
    rotten_tomatoes_score: 92,
    poster_url: null,
    explanation: {
      why_it_matches: "Matches your slow-burn horror preferences.",
      most_influential_factors: ["theme fit", "pacing"],
      why_it_beat_alternatives: "Stronger emotional alignment than runners-up.",
      caveats: "Runtime is at the upper end of your preference.",
    },
  },
  runners_up: [
    {
      film_id: "runner-1",
      title: "Runner Film",
      year: 2001,
      runtime: 95,
      director: "Director Two",
      synopsis: "Should not appear on stage 2 short layout.",
      letterboxd_rating: 3.9,
      tmdb_rating: 6.5,
      rotten_tomatoes_score: 80,
      poster_url: null,
      explanation: {
        why_it_matches: "Solid alternative with overlapping themes.",
        most_influential_factors: ["semantic fit"],
        why_it_beat_alternatives: null,
        caveats: null,
      },
    },
  ],
};

describe("RecommendationCeremony", () => {
  beforeEach(() => {
    __resetCeremonyGatesForTests();
    pushMock.mockReset();
    replaceMock.mockReset();
    useFilmsWatchProvidersMock.mockClear();
    useFilmsWatchProvidersMock.mockReturnValue(new Map());
    pathname = "/recommend/results/session-1";
    searchParams = new URLSearchParams("stage=1");
    armCeremonyGate("session-1");
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
        constructor() {}
      },
    );
  });

  afterEach(() => {
    cleanup();
    __resetCeremonyGatesForTests();
    vi.unstubAllGlobals();
  });

  it("fresh stage 1 → Next push stage 2; stage 2 → Next replace stage 3", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <RecommendationCeremony
        mode="fresh"
        data={recommendation}
        sessionId="session-1"
      />,
    );

    expect(screen.getByTestId("ceremony-progress")).toHaveTextContent("1 / 3");
    expect(screen.getByTestId("ceremony-stage-winner")).toBeInTheDocument();
    expect(screen.queryByTestId("watch-provider-icons")).not.toBeInTheDocument();
    expect(screen.queryByText("Synopsis")).not.toBeInTheDocument();
    expect(screen.queryByText("Caveats")).not.toBeInTheDocument();
    expect(screen.queryByText("Why it beat alternatives")).not.toBeInTheDocument();
    expect(screen.getByText("theme fit")).toBeInTheDocument();
    expect(
      screen.getByText("Matches your slow-burn horror preferences."),
    ).toBeInTheDocument();

    const next = screen.getByTestId("ceremony-next");
    expect(next.className).toMatch(/min-h-11/);
    await user.click(next);
    expect(pushMock).toHaveBeenCalledWith(
      "/recommend/results/session-1?stage=2",
    );

    searchParams = new URLSearchParams("stage=2");
    rerender(
      <RecommendationCeremony
        mode="fresh"
        data={recommendation}
        sessionId="session-1"
      />,
    );

    expect(screen.getByTestId("ceremony-progress")).toHaveTextContent("2 / 3");
    expect(screen.getByTestId("ceremony-stage-runners-up")).toBeInTheDocument();
    expect(screen.getByTestId("runner-focus-panel")).toBeInTheDocument();
    expect(
      screen.queryByText("Should not appear on stage 2 short layout."),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("watch-provider-icons")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("ceremony-next"));
    expect(replaceMock).toHaveBeenCalledWith(
      "/recommend/results/session-1?stage=3",
    );
  });

  it("stage 3 shows full record, providers hook, and profile summary", async () => {
    searchParams = new URLSearchParams("stage=3");
    useFilmsWatchProvidersMock.mockReturnValue(
      new Map([
        [
          "winner-1",
          {
            data: {
              film_id: "winner-1",
              tmdb_id: 1,
              country_code: "GB",
              link: null,
              categories: [
                {
                  type: "flatrate",
                  label: "Stream",
                  providers: [
                    {
                      provider_id: 8,
                      provider_name: "Netflix",
                      logo_url: "https://image.tmdb.org/t/p/w92/netflix.jpg",
                      display_priority: 1,
                    },
                  ],
                },
              ],
            },
            isLoading: false,
            isError: false,
          },
        ],
      ]),
    );

    render(
      <RecommendationCeremony
        mode="fresh"
        data={recommendation}
        sessionId="session-1"
      />,
    );

    await waitFor(() => {
      expect(useFilmsWatchProvidersMock).toHaveBeenCalled();
    });

    expect(screen.getByTestId("ceremony-stage-record")).toBeInTheDocument();
    expect(screen.getByText("Synopsis")).toBeInTheDocument();
    expect(screen.getByText("Why it beat alternatives")).toBeInTheDocument();
    expect(screen.getByText("Caveats")).toBeInTheDocument();
    expect(screen.getByTestId("watch-provider-icons")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /view answer summary/i })).toBeInTheDocument();
    expect(screen.getByTestId("ceremony-done").className).toMatch(/min-h-11/);
    expect(screen.getByTestId("ceremony-replay").className).toMatch(/min-h-11/);
  });

  it("history mode with missing stage lands on stage 3", () => {
    pathname = "/history/session-1";
    searchParams = new URLSearchParams("");
    __resetCeremonyGatesForTests();

    render(
      <RecommendationCeremony
        mode="history"
        data={recommendation}
        sessionId="session-1"
        onRequestDelete={() => undefined}
      />,
    );

    expect(screen.getByTestId("ceremony-progress")).toHaveTextContent("3 / 3");
    expect(screen.getByTestId("ceremony-stage-record")).toBeInTheDocument();
    expect(screen.getByTestId("ceremony-delete")).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("Replay arms gate and pushes stage 1; landing on stage 3 clears the gate", async () => {
    const user = userEvent.setup();
    pathname = "/history/session-1";
    searchParams = new URLSearchParams("stage=3");
    __resetCeremonyGatesForTests();

    const { rerender } = render(
      <RecommendationCeremony
        mode="history"
        data={recommendation}
        sessionId="session-1"
      />,
    );

    expect(isCeremonyArmed("session-1")).toBe(false);
    await user.click(screen.getByTestId("ceremony-replay"));
    expect(isCeremonyArmed("session-1")).toBe(true);
    expect(pushMock).toHaveBeenCalledWith("/history/session-1?stage=1");

    searchParams = new URLSearchParams("stage=3");
    rerender(
      <RecommendationCeremony
        mode="history"
        data={recommendation}
        sessionId="session-1"
      />,
    );

    await waitFor(() => {
      expect(isCeremonyArmed("session-1")).toBe(false);
    });
  });

  it("cold-load unarmed stage 1 coerces to stage 3", async () => {
    __resetCeremonyGatesForTests();
    searchParams = new URLSearchParams("stage=1&dev=1");

    render(
      <RecommendationCeremony
        mode="fresh"
        data={recommendation}
        sessionId="session-1"
      />,
    );

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith(
        "/recommend/results/session-1?stage=3&dev=1",
      );
    });
  });

  it("exposes reduced-motion data attribute when preferred", async () => {
    const listeners: Array<() => void> = [];
    const matchMediaMock = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      addEventListener: (_: string, cb: () => void) => {
        listeners.push(cb);
      },
      removeEventListener: vi.fn(),
    }));
    vi.stubGlobal("matchMedia", matchMediaMock);

    render(
      <RecommendationCeremony
        mode="fresh"
        data={recommendation}
        sessionId="session-1"
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("recommendation-ceremony")).toHaveAttribute(
        "data-reduced-motion",
        "true",
      );
    });
    expect(
      document.querySelector(".ceremony-reduced-motion"),
    ).toBeInTheDocument();

    vi.unstubAllGlobals();
  });
});
