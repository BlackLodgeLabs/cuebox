import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_WATCHLIST_FILTERS,
  WatchlistFilterSheet,
  type WatchlistFilterValues,
} from "@/components/watchlist-filter-sheet";

const seeded: WatchlistFilterValues = {
  search: "matrix",
  enrichmentStatus: "ready",
  year: "1999",
  sort: "title",
  sortDir: "asc",
  createdFrom: "2024-01-01",
  createdTo: "2024-12-31",
};

describe("WatchlistFilterSheet", () => {
  afterEach(() => {
    cleanup();
    document.body.style.pointerEvents = "";
  });

  it("prefills drafts from values when opened", () => {
    render(
      <WatchlistFilterSheet
        open
        onOpenChange={vi.fn()}
        values={seeded}
        onApply={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/^Search$/i)).toHaveValue("matrix");
    expect(screen.getByLabelText(/^Year$/i)).toHaveValue(1999);
    expect(screen.getByRole("button", { name: /Apply/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Clear/i })).toBeInTheDocument();
  });

  it("Apply commits draft values and Clear commits defaults", () => {
    const onApply = vi.fn();
    const onClear = vi.fn();

    render(
      <WatchlistFilterSheet
        open
        onOpenChange={vi.fn()}
        values={DEFAULT_WATCHLIST_FILTERS}
        onApply={onApply}
        onClear={onClear}
      />,
    );

    const search = screen.getByLabelText(/^Search$/i);
    fireEvent.change(search, { target: { value: "blade" } });
    fireEvent.click(screen.getByRole("button", { name: /Apply/i }));

    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ search: "blade" }),
    );

    fireEvent.click(screen.getByRole("button", { name: /Clear/i }));
    expect(onClear).toHaveBeenCalled();
  });

  it("discards draft edits when closed without Apply", () => {
    const onApply = vi.fn();
    const onOpenChange = vi.fn();

    const { rerender } = render(
      <WatchlistFilterSheet
        open
        onOpenChange={onOpenChange}
        values={DEFAULT_WATCHLIST_FILTERS}
        onApply={onApply}
        onClear={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText(/^Search$/i), {
      target: { value: "ghost" },
    });

    rerender(
      <WatchlistFilterSheet
        open={false}
        onOpenChange={onOpenChange}
        values={DEFAULT_WATCHLIST_FILTERS}
        onApply={onApply}
        onClear={vi.fn()}
      />,
    );

    rerender(
      <WatchlistFilterSheet
        open
        onOpenChange={onOpenChange}
        values={DEFAULT_WATCHLIST_FILTERS}
        onApply={onApply}
        onClear={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/^Search$/i)).toHaveValue("");
    expect(onApply).not.toHaveBeenCalled();
  });
});
