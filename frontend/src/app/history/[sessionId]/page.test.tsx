import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import HistoryDetailPage from "@/app/history/[sessionId]/page";
import { createQueryWrapper } from "@/test/query-wrapper";
import type { RecommendationDetailResponse } from "@/types/api";

const { useRecommendationMock } = vi.hoisted(() => ({
  useRecommendationMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ sessionId: "session-1" }),
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/history/session-1",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/hooks/use-recommendations", () => ({
  useRecommendation: () => useRecommendationMock(),
  useDeleteRecommendation: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@/hooks/use-dev-mode", () => ({
  useDevModeEnabled: () => ({ data: false }),
}));

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return {
    ...actual,
    getFilmWatchProviders: vi.fn().mockResolvedValue({
      film_id: "witch",
      tmdb_id: 1,
      country_code: "GB",
      link: null,
      categories: [],
    }),
  };
});

function session(): RecommendationDetailResponse {
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
      poster_url: null,
      backdrop_url: "https://image.tmdb.org/t/p/w1280/witch-backdrop.jpg",
      genres: ["Folk horror"],
      explanation: {
        why_it_matches: "The same folk dread you rated highly in The Wicker Man.",
        why_it_matches_short: null,
        most_influential_factors: [],
        why_it_beat_alternatives: null,
        caveats: null,
      },
    },
    runners_up: [],
  };
}

function renderDetail() {
  const { Wrapper } = createQueryWrapper();
  return render(
    <Wrapper>
      <HistoryDetailPage />
    </Wrapper>,
  );
}

describe("History detail programme", () => {
  afterEach(() => {
    cleanup();
    useRecommendationMock.mockReset();
  });

  it("opens the dated programme with History back and New pick, never the ceremony", async () => {
    useRecommendationMock.mockReturnValue({
      data: session(),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderDetail();

    expect(await screen.findByRole("heading", { level: 1, name: "Sat 14 Nov" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to History" })).toHaveAttribute("href", "/history");
    expect(screen.getByRole("link", { name: "New pick" })).toHaveAttribute("href", "/recommend");
    expect(screen.getByRole("heading", { level: 2, name: "The Witch" })).toBeInTheDocument();
    expect(screen.queryByTestId("recommendation-ceremony")).not.toBeInTheDocument();
    expect(screen.queryByText("1 / 3")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /replay/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Tonight’s programme")).not.toBeInTheDocument();
  });

  it("shows an error state when the night cannot be loaded", () => {
    useRecommendationMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    });

    renderDetail();

    expect(screen.getByText("Could not load this recommendation session.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });
});
