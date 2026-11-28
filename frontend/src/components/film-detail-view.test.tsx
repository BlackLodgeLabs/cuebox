import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FilmDetailView } from "@/components/film-detail-view";
import type { FilmDetail, FilmMetadataBlock, SimilarFilm } from "@/types/api";

afterEach(() => {
  cleanup();
});

const browse = vi.hoisted(() => ({
  trailerUrl: "https://www.youtube.com/watch?v=official" as string | null,
  similar: [] as SimilarFilm[],
}));

vi.mock("next/image", () => ({
  default: (props: { alt: string }) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={props.alt} />;
  },
}));

vi.mock("@/components/edit-film-match-dialog", () => ({
  EditFilmMatchDialog: () => null,
}));

vi.mock("@/components/where-to-watch-section", () => ({
  WhereToWatchSection: () => <div data-testid="where-to-watch">Where to Watch</div>,
}));

vi.mock("@/components/watch-review-dialog", () => ({
  WatchReviewDialog: ({
    open,
    mode,
    watchId,
  }: {
    open: boolean;
    mode: string;
    watchId?: string;
  }) =>
    open ? (
      <div
        role="dialog"
        aria-label="Review sheet"
        data-mode={mode}
        data-watch-id={watchId ?? ""}
      />
    ) : null,
  watchToDialogProps: (watch: { id: string }) => ({ watchId: watch.id }),
}));

vi.mock("@/hooks/use-films", () => ({
  useFilmTrailer: () => ({
    data: browse.trailerUrl ? { url: browse.trailerUrl, name: "Trailer", site: "YouTube" } : { url: null },
    isLoading: false,
    isError: false,
  }),
  useSimilarFilms: () => ({
    data: browse.similar,
    isLoading: false,
    isError: false,
  }),
}));

const metadata: FilmMetadataBlock = {
  tmdb_id: 76203,
  imdb_id: "tt2024544",
  original_title: "12 Years a Slave",
  runtime: 134,
  synopsis: "In the antebellum United States…",
  genres: ["Drama", "History"],
  keywords: ["slavery"],
  original_language: "en",
  country: "US",
  director: "Steve McQueen",
  tmdb_rating: 7.9,
  rotten_tomatoes_score: 95,
  letterboxd_rating: 4.2,
  poster_url: "https://image.tmdb.org/t/p/w500/poster.jpg",
  backdrop_url: "https://image.tmdb.org/t/p/w1280/backdrop.jpg",
  match_confidence: 1,
  metadata_source: "tmdb",
};

const readyFilm: FilmDetail = {
  id: "film-1",
  title: "12 Years a Slave",
  year: 2013,
  letterboxd_uri: "https://boxd.it/2D2e",
  status: "active",
  enrichment_status: "ready",
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  metadata,
  semantic_profile: {
    subgenres: ["historical drama"],
    themes: ["freedom"],
    tones: ["somber"],
    visual_descriptors: [],
    emotional_outcomes: [],
    viewing_contexts: [],
    complexity: 8,
    pacing: 5,
    energy: 4,
    obscurity: 2,
    semantic_summary: "A harrowing true story.",
    semantic_version: "1",
    generated_by_model: "test",
    generated_at: "2024-01-01T00:00:00Z",
  },
  watches: [],
};

const emptyFilm: FilmDetail = {
  ...readyFilm,
  enrichment_status: "pending",
  metadata: null,
  semantic_profile: null,
};

function neighbour(status: SimilarFilm["status"], title: string): SimilarFilm {
  return {
    id: title,
    title,
    year: 2015,
    letterboxd_uri: "https://boxd.it/x",
    status,
    enrichment_status: "ready",
    poster_url: null,
    director: null,
    runtime: 92,
    genres: ["Horror"],
    backdrop_url: null,
    latest_score: null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    semantic_line: "The same folk dread.",
  };
}

describe("FilmDetailView", () => {
  afterEach(() => {
    browse.trailerUrl = "https://www.youtube.com/watch?v=official";
    browse.similar = [];
  });

  it("uses a backdrop hero, a 40px title, and a mono meta line", () => {
    render(<FilmDetailView film={readyFilm} />);

    expect(screen.getByRole("heading", { level: 1, name: "12 Years a Slave" })).toHaveClass(
      "text-cb-display",
    );
    expect(screen.queryByRole("heading", { name: /12 Years a Slave \(2013\)/ })).not.toBeInTheDocument();
    expect(screen.getByText("2013 · Drama · 134m · Steve McQueen")).toBeInTheDocument();
    expect(screen.getByText("On your watchlist")).toHaveClass("uppercase", "text-cb-teal");
  });

  it("does not use the poster as the hero when the backdrop is missing", () => {
    render(
      <FilmDetailView
        film={{
          ...readyFilm,
          metadata: { ...metadata, backdrop_url: null },
        }}
      />,
    );

    expect(screen.queryByText("NO POSTER")).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("shows TMDB and Rotten Tomatoes percentages and no Letterboxd score", () => {
    render(<FilmDetailView film={readyFilm} />);

    const scores = screen.getByTestId("community-scores");
    expect(within(scores).getByText("79%")).toBeInTheDocument();
    expect(within(scores).getByText("95%")).toBeInTheDocument();
    expect(within(scores).queryByText(/letterboxd/i)).not.toBeInTheDocument();
    expect(within(scores).queryByText("4.2")).not.toBeInTheDocument();
    expect(within(scores).queryByText("84%")).not.toBeInTheDocument();
    expect(screen.getByLabelText("TMDB 79 percent")).toBeInTheDocument();
    expect(screen.getByLabelText("RT 95 percent")).toBeInTheDocument();
  });

  it("hides Rotten Tomatoes when OMDb has no score", () => {
    render(
      <FilmDetailView
        film={{
          ...readyFilm,
          metadata: { ...metadata, rotten_tomatoes_score: null, letterboxd_rating: 3.8 },
        }}
      />,
    );

    const scores = screen.getByTestId("community-scores");
    expect(within(scores).getByText("79%")).toBeInTheDocument();
    expect(within(scores).queryByText("RT")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/letterboxd/i)).not.toBeInTheDocument();
  });

  it.each([
    {
      name: "explicit watchlistTab wins",
      film: { ...readyFilm, status: "watched" as const },
      watchlistTab: "archived" as const,
      href: "/watchlist?tab=archived",
    },
    {
      name: "active status → /watchlist",
      film: { ...readyFilm, status: "active" as const },
      watchlistTab: undefined,
      href: "/watchlist",
    },
    {
      name: "watched status → watched tab",
      film: { ...readyFilm, status: "watched" as const },
      watchlistTab: undefined,
      href: "/watchlist?tab=watched",
    },
    {
      name: "pending_watch_review → watched tab",
      film: { ...readyFilm, status: "pending_watch_review" as const },
      watchlistTab: undefined,
      href: "/watchlist?tab=watched",
    },
    {
      name: "archived status → archived tab",
      film: { ...readyFilm, status: "archived" as const },
      watchlistTab: undefined,
      href: "/watchlist?tab=archived",
    },
  ])("back link: $name", ({ film, watchlistTab, href }) => {
    render(<FilmDetailView film={film} watchlistTab={watchlistTab} />);
    expect(screen.getByRole("link", { name: /watchlist/i })).toHaveAttribute("href", href);
  });

  it("puts Trailer, an amber Watch, Watched?, and More on the bottom bar", () => {
    render(
      <FilmDetailView film={readyFilm} onStatusTransition={vi.fn()} />,
    );

    expect(screen.getByRole("button", { name: "Trailer" })).toBeInTheDocument();
    const watch = screen.getByRole("button", { name: "Watch" });
    expect(watch.className).toContain("cb-press");
    expect(watch.querySelector(".shadow-glow")).not.toBeNull();
    expect(watch.querySelector(".bg-cb-accent")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Watched?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "More" })).toBeInTheDocument();
  });

  it("hides Trailer when the film has none", () => {
    browse.trailerUrl = null;
    render(<FilmDetailView film={readyFilm} />);
    expect(screen.queryByRole("button", { name: "Trailer" })).not.toBeInTheDocument();
  });

  it("says Watched once a watch is logged", () => {
    render(
      <FilmDetailView
        film={{
          ...readyFilm,
          status: "watched",
          watches: [
            {
              id: "watch-1",
              score: 4,
              watched_at: "2026-11-02",
              notes: "Still thinking about it.",
              source: "manual",
              is_pending: false,
              created_at: "2024-01-01T00:00:00Z",
              updated_at: "2024-01-01T00:00:00Z",
            },
          ],
        }}
      />,
    );

    expect(screen.getByRole("button", { name: "Watched" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Watched?" })).not.toBeInTheDocument();
  });

  it("opens create from Watched? and Log another watch, and edit from the pencil", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<FilmDetailView film={readyFilm} />);
    await user.click(screen.getByRole("button", { name: "Watched?" }));
    expect(screen.getByRole("dialog", { name: "Review sheet" })).toHaveAttribute(
      "data-mode",
      "create",
    );
    unmount();

    render(
      <FilmDetailView
        film={{
          ...readyFilm,
          status: "watched",
          watches: [
            {
              id: "watch-9",
              score: 4,
              watched_at: "2026-11-02",
              notes: null,
              source: "manual",
              is_pending: false,
              created_at: "2024-01-01T00:00:00Z",
              updated_at: "2024-01-01T00:00:00Z",
            },
          ],
        }}
      />,
    );
    await user.click(screen.getByRole("tab", { name: "You" }));
    await user.click(screen.getByRole("button", { name: "Log another watch" }));
    expect(screen.getByRole("dialog", { name: "Review sheet" })).toHaveAttribute(
      "data-mode",
      "create",
    );

    await user.click(screen.getByRole("button", { name: "Edit watch, 2 Nov 2026" }));
    expect(screen.getByRole("dialog", { name: "Review sheet" })).toHaveAttribute(
      "data-mode",
      "edit",
    );
    expect(screen.getByRole("dialog", { name: "Review sheet" })).toHaveAttribute(
      "data-watch-id",
      "watch-9",
    );
  });

  it("archives and removes from the More sheet with no confirmation", async () => {
    const user = userEvent.setup();
    const onStatusTransition = vi.fn();
    const onRemove = vi.fn();
    render(
      <FilmDetailView
        film={readyFilm}
        onStatusTransition={onStatusTransition}
        onRemove={onRemove}
      />,
    );

    await user.click(screen.getByRole("button", { name: "More" }));
    const sheet = await screen.findByRole("dialog", { name: "More" });
    expect(sheet).toHaveAttribute("data-open-ms", "800");
    expect(sheet).toHaveAttribute("data-dismiss-px", "120");

    await user.click(within(sheet).getByRole("button", { name: "Archive" }));
    expect(onStatusTransition).toHaveBeenCalledWith("archived");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "More" }));
    const reopened = await screen.findByRole("dialog", { name: "More" });
    await user.click(within(reopened).getByRole("button", { name: "Remove from watchlist" }));
    expect(onRemove).toHaveBeenCalledOnce();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("keeps Letterboxd, TMDB, and IMDb in the More sheet", async () => {
    const user = userEvent.setup();
    render(<FilmDetailView film={readyFilm} />);
    await user.click(screen.getByRole("button", { name: "More" }));

    expect(screen.getByRole("link", { name: /open in letterboxd/i })).toHaveAttribute(
      "href",
      "https://boxd.it/2D2e",
    );
    expect(screen.getByRole("link", { name: /open in tmdb/i })).toHaveAttribute(
      "href",
      "https://www.themoviedb.org/movie/76203",
    );
    expect(screen.getByRole("link", { name: /open in imdb/i })).toHaveAttribute(
      "href",
      "https://www.imdb.com/title/tt2024544",
    );
  });

  it("shows Close to this for unwatched watchlist films only", async () => {
    const user = userEvent.setup();
    browse.similar = [
      neighbour("active", "The Witch"),
      neighbour("watched", "Lamb"),
      neighbour("archived", "Midsommar"),
    ];
    render(<FilmDetailView film={readyFilm} />);
    await user.click(screen.getByRole("tab", { name: "You" }));

    expect(screen.getByRole("heading", { name: "Close to this on your watchlist" })).toBeInTheDocument();
    expect(screen.getByText("The Witch")).toBeInTheDocument();
    expect(screen.getByText("2015 · 92m")).toBeInTheDocument();
    expect(screen.queryByText("Lamb")).not.toBeInTheDocument();
    expect(screen.queryByText("Midsommar")).not.toBeInTheDocument();
  });

  it("omits Close to this when the film is not on the watchlist", async () => {
    const user = userEvent.setup();
    browse.similar = [neighbour("active", "The Witch")];
    render(<FilmDetailView film={readyFilm} onWatchlist={false} />);
    await user.click(screen.getByRole("tab", { name: "You" }));

    expect(screen.queryByText("Close to this on your watchlist")).not.toBeInTheDocument();
    expect(screen.queryByText("The Witch")).not.toBeInTheDocument();
  });

  it("degrades enrichment-empty without a broken empty card shell", async () => {
    const user = userEvent.setup();
    render(<FilmDetailView film={emptyFilm} />);

    expect(screen.getByText(/enrichment data is not available yet/i)).toBeInTheDocument();
    expect(screen.getByText("On your watchlist")).toBeInTheDocument();
    const emptyCopy = screen.getByText(/enrichment data is not available yet/i);
    expect(emptyCopy.closest("[class*='rounded']")).toBeNull();
    expect(screen.queryByRole("heading", { name: /^overview$/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "More" }));
    expect(screen.getByRole("link", { name: /open in letterboxd/i })).toBeInTheDocument();
  });

  it.each([
    ["pending_watch_review", "Watched"],
    ["watched", "Watched"],
    ["archived", "Archived"],
  ] as const)("maps status %s to kicker %s", (status, label) => {
    render(<FilmDetailView film={{ ...readyFilm, status }} />);
    expect(screen.getAllByText(label).length).toBeGreaterThan(0);
  });

  it("keeps the updating metadata hint while enriching", () => {
    render(
      <FilmDetailView film={{ ...readyFilm, enrichment_status: "enriching" }} />,
    );
    expect(screen.getByText("Updating metadata…")).toBeInTheDocument();
  });
});
