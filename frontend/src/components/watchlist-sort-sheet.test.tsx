import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WatchlistSortSheet } from "@/components/watchlist-sort-sheet";
import { WATCHLIST_SORTS } from "@/lib/watchlist-sort";

describe("WatchlistSortSheet", () => {
  afterEach(() => {
    cleanup();
    document.body.style.pointerEvents = "";
  });

  it("lists the five locked sorts and marks the current row in teal with a check", () => {
    render(
      <WatchlistSortSheet
        open
        onOpenChange={vi.fn()}
        value={WATCHLIST_SORTS[0]}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Sort by" })).toBeInTheDocument();
    const selected = screen.getByRole("option", { name: /Date added/ });
    expect(selected).toHaveAttribute("aria-selected", "true");
    expect(selected.className).toContain("text-cb-teal");
    expect(selected).toHaveTextContent("Newest first");
    expect(selected).toHaveTextContent("Selected");

    expect(screen.getByRole("option", { name: /Title/ })).toHaveTextContent("A to Z");
    expect(screen.getByRole("option", { name: /^Year/ })).toHaveTextContent("Newest first");
    expect(screen.getByRole("option", { name: /Runtime/ })).toHaveTextContent("Shortest first");
    expect(screen.getByRole("option", { name: /Rating/ })).toHaveTextContent("Highest first");
    expect(screen.getByRole("option", { name: /Rating/ })).toHaveAttribute("aria-selected", "false");
  });

  it("chooses runtime, shortest first, and closes", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <WatchlistSortSheet
        open
        onOpenChange={onOpenChange}
        value={WATCHLIST_SORTS[0]}
        onSelect={onSelect}
      />,
    );

    await user.click(screen.getByRole("option", { name: /Runtime/ }));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ sort: "runtime", sortDir: "asc", label: "Runtime" }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
