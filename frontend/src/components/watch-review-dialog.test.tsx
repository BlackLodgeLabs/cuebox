import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WatchReviewDialog } from "@/components/watch-review-dialog";

const completeMutateAsync = vi.fn();
const cancelMutateAsync = vi.fn();

vi.mock("@/hooks/use-films", () => ({
  useCompleteWatchReview: () => ({
    mutateAsync: completeMutateAsync,
    isPending: false,
  }),
  useCancelWatchReview: () => ({
    mutateAsync: cancelMutateAsync,
    isPending: false,
  }),
  useUpdateFilmWatch: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

describe("WatchReviewDialog", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("disables save until score and date are valid", () => {
    render(
      <WatchReviewDialog
        filmId="film-1"
        filmTitle="Heat"
        open
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: "4 stars" }));
    expect(screen.getByRole("button", { name: "Save" })).not.toBeDisabled();
  });

  it("calls cancel endpoint when Cancel is clicked with cancelOnDismiss", async () => {
    const onOpenChange = vi.fn();
    render(
      <WatchReviewDialog
        filmId="film-1"
        filmTitle="Heat"
        open
        cancelOnDismiss
        onOpenChange={onOpenChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel watch review" }));
    expect(cancelMutateAsync).toHaveBeenCalledWith("film-1");
  });

  it("closes without cancel API when cancelOnDismiss is false", async () => {
    const onOpenChange = vi.fn();
    render(
      <WatchReviewDialog
        filmId="film-1"
        filmTitle="Heat"
        open
        onOpenChange={onOpenChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Close watch review" }));
    expect(cancelMutateAsync).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
