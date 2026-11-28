import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import HomePage from "@/app/page";
import { createQueryWrapper } from "@/test/query-wrapper";

const { useFilmsMock, useHomeActiveFilmsMock, useFilmWatchProvidersMock } = vi.hoisted(() => ({
  useFilmsMock: vi.fn(),
  useHomeActiveFilmsMock: vi.fn(),
  useFilmWatchProvidersMock: vi.fn(),
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
  useFilms: (...args: unknown[]) => useFilmsMock(...args),
  useHomeActiveFilms: () => useHomeActiveFilmsMock(),
}));

vi.mock("@/hooks/use-watch-providers", () => ({
  useFilmWatchProviders: (...args: unknown[]) => useFilmWatchProvidersMock(...args),
}));

vi.mock("@/lib/today-feature", async () => {
  const actual = await vi.importActual<typeof import("@/lib/today-feature")>(
    "@/lib/today-feature",
  );
  return {
    ...actual,
    ukCalendarDate: () => "2026-11-27",
    todayFeatureOffset: () => 1,
  };
});

const lamb = {
  id: "lamb",
  title: "Lamb",
  year: 2021,
  genres: ["Drama"],
  runtime: 106,
  tones: ["quiet"],
  emotional_outcomes: ["grief"],
  synopsis: "A childless couple adopt something that isn't quite a lamb.",
  backdrop_url: "https://image.tmdb.org/t/p/w1280/lamb.jpg",
  poster_url: null,
  status: "active",
};

const wicker = {
  id: "wicker",
  title: "The Wicker Man",
  year: 1973,
  genres: ["Folk horror"],
  runtime: 88,
  tones: ["ritual"],
  emotional_outcomes: ["unease"],
  synopsis: "A devout policeman lands on a Hebridean island where May Day comes with a sacrifice.",
  backdrop_url: "https://image.tmdb.org/t/p/w1280/wicker.jpg",
  poster_url: "https://image.tmdb.org/t/p/w500/wicker.jpg",
  status: "active",
};

function filmResponse(offset: number) {
  const film = offset === 1 ? lamb : wicker;
  return {
    data: {
      data: [film],
      pagination: { total: 2, limit: 1, offset, has_more: false },
    },
    isLoading: false,
    isSuccess: true,
    isError: false,
    refetch: vi.fn(),
  };
}

function renderHome() {
  const { Wrapper } = createQueryWrapper();
  return render(
    <Wrapper>
      <HomePage />
    </Wrapper>,
  );
}

describe("Home", () => {
  afterEach(() => {
    cleanup();
    useFilmsMock.mockReset();
    useHomeActiveFilmsMock.mockReset();
    useFilmWatchProvidersMock.mockReset();
    document.body.style.pointerEvents = "";
    vi.restoreAllMocks();
  });

  function readyCatalogue() {
    useHomeActiveFilmsMock.mockReturnValue({
      data: { films: [wicker, lamb], total: 2 },
      isLoading: false,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    });
    useFilmsMock.mockImplementation((params?: { offset?: number }) =>
      filmResponse(params?.offset ?? 0),
    );
    useFilmWatchProvidersMock.mockReturnValue({
      data: {
        categories: [
          {
            type: "flatrate",
            label: "Stream",
            providers: [
              {
                provider_id: 9,
                provider_name: "Prime Video",
                logo_url: null,
                display_priority: 1,
              },
            ],
          },
        ],
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
  }

  it("shows one daily feature, the night's actions, and rows from the fill rule", () => {
    readyCatalogue();
    renderHome();

    expect(useFilmsMock).toHaveBeenCalledWith(
      { status: "active", limit: 1, offset: 1 },
      { enabled: true },
    );
    expect(screen.getByRole("heading", { name: "Lamb" })).toBeInTheDocument();
    expect(screen.getByText("Today's feature · from your watchlist")).toBeInTheDocument();
    expect(screen.getByText("2021 · Drama · 106m · Prime Video")).toBeInTheDocument();
    expect(
      screen.getByText("A childless couple adopt something that isn't quite a lamb."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Get a pick for tonight" })).toHaveAttribute(
      "href",
      "/recommend",
    );
    expect(screen.getAllByRole("link", { name: "See all" }).map((link) => link.getAttribute("href"))).toEqual([
      "/watchlist?genres=Horror,Folk%20horror",
      "/watchlist?genres=Drama",
      "/watchlist?runtime=le_90",
    ]);
    expect(screen.queryByRole("heading", { name: "What do you want to watch?" })).not.toBeInTheDocument();
    expect(screen.queryByText(/System status/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+ films/i)).not.toBeInTheDocument();
  });

  it("opens Where to watch in a sheet with the locked timings", async () => {
    const user = userEvent.setup();
    readyCatalogue();
    renderHome();

    await user.click(screen.getByRole("button", { name: "Where to watch" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("data-open-ms", "800");
    expect(dialog).toHaveAttribute("data-close-ms", "700");
    expect(screen.getByRole("heading", { name: "Where to watch" })).toBeInTheDocument();
    expect(screen.getByText("Prime Video")).toBeInTheDocument();
  });

  it("opens Surprise me on another watchlist film and Another moves on", async () => {
    const user = userEvent.setup();
    vi.spyOn(Math, "random").mockReturnValue(0);
    readyCatalogue();
    renderHome();

    await user.click(screen.getByRole("button", { name: "Surprise me" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("data-open-ms", "800");
    expect(dialog).toHaveAttribute("data-close-ms", "700");
    expect(screen.getByText("A suggestion from your watchlist")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "The Wicker Man" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Another" }));
    expect(screen.queryByRole("heading", { name: "The Wicker Man" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: "Lamb" }).length).toBeGreaterThan(0);
  });

  it("offers import when the active watchlist is empty", () => {
    useHomeActiveFilmsMock.mockReturnValue({
      data: { films: [], total: 0 },
      isLoading: false,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    });
    useFilmsMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isSuccess: false,
      isError: false,
      refetch: vi.fn(),
    });
    useFilmWatchProvidersMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderHome();

    expect(screen.getByRole("heading", { name: "Nothing on your watchlist yet" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Import watchlist" })).toHaveAttribute("href", "/import");
    expect(screen.queryByRole("button", { name: "Where to watch" })).not.toBeInTheDocument();
    expect(screen.queryByText(/System status/i)).not.toBeInTheDocument();
  });

  it("shows an error when the watchlist cannot be loaded", () => {
    useHomeActiveFilmsMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      isSuccess: false,
      refetch: vi.fn(),
    });

    renderHome();

    expect(screen.getByText(/Could not reach the API/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
