import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
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

  it("Apply commits draft values and Clear commits defaults", async () => {
    const user = userEvent.setup();
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

    await user.clear(screen.getByLabelText(/^Search$/i));
    await user.type(screen.getByLabelText(/^Search$/i), "blade");
    await user.click(screen.getByRole("button", { name: /Apply/i }));

    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ search: "blade" }),
    );

    await user.click(screen.getByRole("button", { name: /Clear/i }));
    expect(onClear).toHaveBeenCalled();
  });

  it("discards draft edits when closed without Apply", async () => {
    const user = userEvent.setup();
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

    await user.type(screen.getByLabelText(/^Search$/i), "ghost");

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
