import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import HomePage from "@/app/page";
import { createQueryWrapper } from "@/test/query-wrapper";

const { useHasWatchlistMock } = vi.hoisted(() => ({
  useHasWatchlistMock: vi.fn(),
}));

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
  useHasWatchlist: () => useHasWatchlistMock(),
}));

function renderHome() {
  const { Wrapper } = createQueryWrapper();
  return render(
    <Wrapper>
      <HomePage />
    </Wrapper>,
  );
}

describe("HomePage hub", () => {
  afterEach(() => {
    cleanup();
    useHasWatchlistMock.mockReset();
  });

  it("returning user shows picker, Create a recommendation, and History", () => {
    useHasWatchlistMock.mockReturnValue({
      data: true,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderHome();

    expect(
      screen.getByRole("heading", { name: "What do you want to watch?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Find a film in your library, create a recommendation, or open History.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("library-search-input")).not.toBeInTheDocument();

    const recommend = screen.getByRole("link", {
      name: "Create a recommendation",
    });
    expect(recommend).toHaveAttribute("href", "/recommend");
    expect(recommend.className).toMatch(/min-h-11/);
    // Create stays filled primary (no outline border treatment)
    expect(recommend.className).not.toMatch(/\bborder-border\b/);

    const history = screen.getByRole("link", { name: "History" });
    expect(history).toHaveAttribute("href", "/history");
    expect(history.className).toMatch(/min-h-11/);
    expect(history.className).toMatch(/border/);

    expect(
      screen.queryByRole("link", { name: "View watchlist" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Review now" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Start questionnaire" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "New recommendation" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "View history" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/System status/i)).not.toBeInTheDocument();
  });

  it("empty watchlist shows Import watchlist and no System status", () => {
    useHasWatchlistMock.mockReturnValue({
      data: false,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderHome();

    expect(
      screen.getByRole("heading", { name: "Welcome to Cuebox" }),
    ).toBeInTheDocument();
    const importLink = screen.getByRole("link", { name: "Import watchlist" });
    expect(importLink).toHaveAttribute("href", "/import");
    expect(screen.queryByTestId("library-search-input")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Create a recommendation" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/System status/i)).not.toBeInTheDocument();
  });
});
