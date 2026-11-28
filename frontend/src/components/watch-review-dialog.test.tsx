import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WatchReviewDialog } from "@/components/watch-review-dialog";
import type { FilmDetail } from "@/types/api";

vi.mock("@number-flow/react", () => ({
  default: ({ value }: { value: number }) => <span>{value}</span>,
}));

const createMutateAsync = vi.fn();
const updateMutateAsync = vi.fn();
const deleteMutateAsync = vi.fn();

vi.mock("@/hooks/use-films", () => ({
  useCreateFilmWatch: () => ({
    mutateAsync: createMutateAsync,
    isPending: false,
  }),
  useUpdateFilmWatch: () => ({
    mutateAsync: updateMutateAsync,
    isPending: false,
  }),
  useDeleteFilmWatch: () => ({
    mutateAsync: deleteMutateAsync,
    isPending: false,
  }),
}));

function todayIsoDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function savedWatch(score: number): FilmDetail {
  return {
    id: "film-1",
    title: "The Wicker Man",
    year: 1973,
    letterboxd_uri: "https://letterboxd.com/film/the-wicker-man/",
    status: "watched",
    enrichment_status: "ready",
    metadata: null,
    semantic_profile: null,
    created_at: "2026-11-28T00:00:00Z",
    updated_at: "2026-11-28T00:00:00Z",
    watches: [
      {
        id: "watch-1",
        score,
        watched_at: null,
        notes: null,
        source: "manual",
        is_pending: false,
        created_at: "2026-11-28T00:00:00Z",
        updated_at: "2026-11-28T00:00:01Z",
      },
    ],
  };
}

function mockReduced(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes("prefers-reduced-motion") ? matches : false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }));
}

function renderCreate() {
  return render(
    <WatchReviewDialog
      open
      mode="create"
      filmId="film-1"
      filmTitle="The Wicker Man"
      year={1973}
      genre="Folk horror"
      onOpenChange={vi.fn()}
    />,
  );
}

describe("WatchReviewDialog", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    delete (window as { matchMedia?: unknown }).matchMedia;
  });

  it("saves on the star tap with one POST, then patches the same watch", async () => {
    mockReduced(false);
    const user = userEvent.setup();
    createMutateAsync.mockResolvedValue(savedWatch(4.5));
    updateMutateAsync.mockResolvedValue({ id: "watch-1" });
    renderCreate();

    expect(screen.getByText("How was it?")).toBeInTheDocument();
    expect(screen.getByText("1973 · Folk horror")).toBeInTheDocument();
    expect(screen.getByText("Tap a star to save")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Today" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();

    const stars = screen.getByRole("radiogroup", { name: "Your rating" });
    expect(stars).toHaveClass("text-cb-accent");
    expect(stars).toHaveAttribute("data-stagger-ms", "70");
    expect(stars).toHaveAttribute("data-fill-ms", "330");
    expect(stars).toHaveAttribute("data-bounce-ms", "190");
    expect(stars).toHaveAttribute("data-bounce-percent", "30");
    expect(stars).toHaveAttribute("data-saved-delay-ms", "40");
    expect(stars).toHaveAttribute("data-saved-fade-ms", "220");
    expect(stars).toHaveAttribute("data-glow", "0.35");

    await user.click(screen.getByRole("radio", { name: "4.5 stars" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Today" })).toBeEnabled();
    });
    expect(createMutateAsync).toHaveBeenCalledTimes(1);
    expect(createMutateAsync).toHaveBeenCalledWith({
      filmId: "film-1",
      body: { score: 4.5 },
    });
    const saved = screen.getByText("Saved").closest("p");
    expect(saved).toHaveClass("text-cb-teal");
    expect(saved?.className ?? "").not.toMatch(/shadow|glow/);
    expect(screen.getByText("Saved").closest("[data-cb-saved]")).toHaveAttribute(
      "data-reveal-ms",
      "840",
    );
    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Today" }));
    expect(updateMutateAsync).toHaveBeenCalledWith({
      filmId: "film-1",
      watchId: "watch-1",
      body: { watched_at: todayIsoDate() },
    });

    await user.type(screen.getByRole("textbox", { name: "Write a note" }), "Cold last act");
    await user.tab();
    expect(updateMutateAsync).toHaveBeenCalledWith({
      filmId: "film-1",
      watchId: "watch-1",
      body: { notes: "Cold last act" },
    });

    await user.click(screen.getByRole("radio", { name: "5 stars" }));
    expect(createMutateAsync).toHaveBeenCalledTimes(1);
    expect(updateMutateAsync).toHaveBeenCalledWith({
      filmId: "film-1",
      watchId: "watch-1",
      body: { score: 5 },
    });
  });

  it("crossfades in 300ms without bounce or glow when motion is reduced", async () => {
    mockReduced(true);
    renderCreate();

    await waitFor(() => {
      const stars = screen.getByRole("radiogroup", { name: "Your rating" });
      expect(stars).toHaveAttribute("data-reduced", "true");
      expect(stars).toHaveAttribute("data-crossfade-ms", "300");
      expect(stars).toHaveAttribute("data-bounce-ms", "0");
      expect(stars).toHaveAttribute("data-glow", "0");
    });
  });

  it("edits only when Save changes is pressed", async () => {
    const user = userEvent.setup();
    updateMutateAsync.mockResolvedValue({ id: "watch-1" });
    const onOpenChange = vi.fn();
    render(
      <WatchReviewDialog
        open
        mode="edit"
        filmId="film-1"
        filmTitle="The Wicker Man"
        year={1973}
        genre="Folk horror"
        watchId="watch-1"
        initialScore={4.5}
        initialWatchedAt="2026-11-02"
        initialNotes="The sunny island."
        onOpenChange={onOpenChange}
      />,
    );

    expect(screen.getByText("Edit review")).toBeInTheDocument();
    expect(screen.getByText("2 Nov 2026")).toBeInTheDocument();
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
    expect(screen.queryByText("Tap a star to save")).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "5 stars" }));
    await user.clear(screen.getByRole("textbox", { name: "Write a note" }));
    await user.type(screen.getByRole("textbox", { name: "Write a note" }), "Still the songs.");
    await user.tab();
    expect(createMutateAsync).not.toHaveBeenCalled();
    expect(updateMutateAsync).not.toHaveBeenCalled();

    const save = screen.getByRole("button", { name: "Save changes" });
    expect(save.className).toContain("bg-cb-accent");
    expect(save.className).toContain("shadow-glow");
    await user.click(save);

    expect(updateMutateAsync).toHaveBeenCalledTimes(1);
    expect(updateMutateAsync).toHaveBeenCalledWith({
      filmId: "film-1",
      watchId: "watch-1",
      body: {
        score: 5,
        watched_at: "2026-11-02",
        notes: "Still the songs.",
      },
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("confirms before deleting a watch and does not change the film", async () => {
    const user = userEvent.setup();
    deleteMutateAsync.mockResolvedValue(undefined);
    render(
      <WatchReviewDialog
        open
        mode="edit"
        filmId="film-1"
        filmTitle="The Wicker Man"
        watchId="watch-1"
        initialScore={4}
        initialWatchedAt="2026-11-02"
        initialNotes=""
        onOpenChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Delete this watch" }));
    expect(
      screen.getByText(
        "This viewing and its rating will be removed from your history. The film will stay marked as watched.",
      ),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(deleteMutateAsync).toHaveBeenCalledWith({
      filmId: "film-1",
      watchId: "watch-1",
    });
    expect(updateMutateAsync).not.toHaveBeenCalled();
    expect(createMutateAsync).not.toHaveBeenCalled();
  });

  it("never sends the 1984 sentinel and treats it as an empty date", async () => {
    const user = userEvent.setup();
    updateMutateAsync.mockResolvedValue({ id: "watch-1" });
    render(
      <WatchReviewDialog
        open
        mode="edit"
        filmId="film-1"
        filmTitle="The Wicker Man"
        watchId="watch-1"
        initialScore={3}
        initialWatchedAt="1984-09-28"
        initialNotes=""
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Add a date" })).toBeInTheDocument();
    expect(screen.queryByText("1984")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(updateMutateAsync).toHaveBeenCalledWith({
      filmId: "film-1",
      watchId: "watch-1",
      body: { score: 3, watched_at: null, notes: null },
    });
    expect(JSON.stringify(updateMutateAsync.mock.calls)).not.toContain("1984-09-28");
  });
});
