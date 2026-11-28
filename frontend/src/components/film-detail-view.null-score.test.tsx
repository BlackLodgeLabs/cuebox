import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FilmDetailView } from "@/components/film-detail-view";
import type { FilmDetail } from "@/types/api";

afterEach(() => {
  cleanup();
});

vi.mock("next/image", () => ({
  default: (props: { alt: string }) => <img alt={props.alt} />,
}));

vi.mock("@/components/edit-film-match-dialog", () => ({
  EditFilmMatchDialog: () => null,
}));

vi.mock("@/components/where-to-watch-section", () => ({
  WhereToWatchSection: () => null,
}));

vi.mock("@/components/watch-review-dialog", () => ({
  WatchReviewDialog: () => null,
  watchToDialogProps: () => ({}),
}));

vi.mock("@/hooks/use-films", () => ({
  useFilmTrailer: () => ({ data: { url: null }, isLoading: false, isError: false }),
  useSimilarFilms: () => ({ data: [], isLoading: false, isError: false }),
}));

const baseFilm: FilmDetail = {
  id: "film-1",
  title: "12 Years a Slave",
  year: 2013,
  letterboxd_uri: "https://boxd.it/2D2e",
  status: "watched",
  enrichment_status: "ready",
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  metadata: null,
  semantic_profile: null,
  watches: [
    {
      id: "watch-1",
      score: null,
      watched_at: "1984-09-28",
      notes: null,
      source: "letterboxd_import",
      is_pending: false,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    },
  ],
};

describe("FilmDetailView null score", () => {
  it("renders unrated watches without inventing stars", async () => {
    const user = userEvent.setup();
    render(<FilmDetailView film={baseFilm} />);
    await user.click(screen.getByRole("tab", { name: "You" }));
    expect(screen.getByText("Unrated")).toBeInTheDocument();
    expect(screen.getByText("Date unknown")).toBeInTheDocument();
    expect(screen.queryByText("1984-09-28")).not.toBeInTheDocument();
    expect(screen.queryByText(/null★/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/0★/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/out of 5/i)).not.toBeInTheDocument();
  });
});
