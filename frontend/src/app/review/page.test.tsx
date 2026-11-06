import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ReviewPage from "@/app/review/page";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("@/hooks/use-films", () => ({
  useReviewRequired: () => ({
    data: {
      data: [
        {
          film_id: "film-1",
          title: "Stalker",
          year: 1979,
          letterboxd_uri: "https://letterboxd.com/film/stalker/",
          review_id: "review-1",
          review_type: "tmdb_match",
          candidate_tmdb_id: 1,
          confidence_score: 0.9,
          candidate_payload: {
            title: "Stalker",
            year: 1979,
            director: "Tarkovsky",
            poster_url: null,
          },
          created_at: "2024-01-01T00:00:00Z",
        },
      ],
      pagination: { total: 1, limit: 50, offset: 0, has_more: false },
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useWatchReviewRequired: () => ({
    data: {
      data: [
        {
          film_id: "film-2",
          title: "Heat",
          year: 1995,
          letterboxd_uri: "https://letterboxd.com/film/heat/",
          poster_url: null,
          pending_watch: {
            id: "watch-1",
            score: 4.5,
            watched_at: "2024-11-01",
            notes: null,
            source: "rss",
            is_pending: true,
            created_at: "2024-11-02T00:00:00Z",
            updated_at: "2024-11-02T00:00:00Z",
          },
          created_at: "2024-11-02T00:00:00Z",
        },
      ],
      pagination: { total: 1, limit: 50, offset: 0, has_more: false },
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-reviews", () => ({
  useAcceptReview: () => ({ mutate: vi.fn(), isPending: false, variables: null }),
  useRejectReview: () => ({ mutate: vi.fn(), isPending: false, variables: null }),
  useResolveLetterboxdReview: () => ({
    mutate: vi.fn(),
    isPending: false,
    variables: null,
  }),
}));

describe("ReviewPage", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders match and watch review sections", () => {
    render(<ReviewPage />);

    expect(screen.getByRole("heading", { name: "Review" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /← home/i })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("heading", { name: "Match review" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Watched films to review" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Heat (1995)")).toBeInTheDocument();
  });

  it("uses ≥44px resolve actions instead of compact sm buttons", () => {
    render(<ReviewPage />);

    for (const name of ["Accept", "Reject", "Choose different match"]) {
      const control = screen.getByRole(name === "Choose different match" ? "link" : "button", {
        name,
      });
      expect(control.className).toMatch(/min-h-11/);
      expect(control.className).not.toMatch(/\bh-8\b/);
    }
  });
});
