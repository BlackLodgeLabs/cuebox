import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
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
  beforeAll(() => {
    // Radix Select calls pointer-capture APIs that jsdom does not implement.
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.scrollIntoView = () => {};
  });

  afterEach(() => {
    cleanup();
    document.body.style.pointerEvents = "";
  });

  it("prefills drafts from values when opened", () => {
    render(
      <WatchlistFilterSheet
        open
        view="active"
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
        view="active"
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
        view="active"
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
        view="active"
        onOpenChange={onOpenChange}
        values={DEFAULT_WATCHLIST_FILTERS}
        onApply={onApply}
        onClear={vi.fn()}
      />,
    );

    rerender(
      <WatchlistFilterSheet
        open
        view="active"
        onOpenChange={onOpenChange}
        values={DEFAULT_WATCHLIST_FILTERS}
        onApply={onApply}
        onClear={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/^Search$/i)).toHaveValue("");
    expect(onApply).not.toHaveBeenCalled();
  });

  it("shows Date watched and Descending when those are the Watched view values", () => {
    render(
      <WatchlistFilterSheet
        open
        view="watched"
        onOpenChange={vi.fn()}
        values={{ ...DEFAULT_WATCHLIST_FILTERS, sort: "watched_at", sortDir: "desc" }}
        onApply={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    expect(screen.getByRole("combobox", { name: "Sort by" })).toHaveTextContent(
      "Date watched",
    );
    expect(screen.getByRole("combobox", { name: "Sort direction" })).toHaveTextContent(
      "Descending",
    );
  });

  it("offers Date watched on the Watched view and hides it on the other views", async () => {
    const user = userEvent.setup();
    const props = {
      open: true,
      onOpenChange: vi.fn(),
      values: DEFAULT_WATCHLIST_FILTERS,
      onApply: vi.fn(),
      onClear: vi.fn(),
    };

    const { rerender } = render(<WatchlistFilterSheet {...props} view="watched" />);
    await user.click(screen.getByRole("combobox", { name: "Sort by" }));
    expect(screen.getByRole("option", { name: "Date watched" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    rerender(<WatchlistFilterSheet {...props} view="active" />);
    await user.click(screen.getByRole("combobox", { name: "Sort by" }));
    expect(screen.queryByRole("option", { name: "Date watched" })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Date added" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    rerender(<WatchlistFilterSheet {...props} view="archived" />);
    await user.click(screen.getByRole("combobox", { name: "Sort by" }));
    expect(screen.queryByRole("option", { name: "Date watched" })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Title" })).toBeInTheDocument();
  });
});
