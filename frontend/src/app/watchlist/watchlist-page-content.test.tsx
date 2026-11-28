import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { WatchlistPageContent } from "@/app/watchlist/watchlist-page-content";
import { createQueryWrapper } from "@/test/query-wrapper";
import type { FilmSummary, FilmsQueryParams } from "@/types/api";

const mockReplace = vi.fn();
let searchParams = new URLSearchParams();

const { mockGetFilms, mockGetWatchlistGenres } = vi.hoisted(() => ({
  mockGetFilms: vi.fn(),
  mockGetWatchlistGenres: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: (...args: unknown[]) => mockReplace(...args) }),
  useSearchParams: () => searchParams,
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

vi.mock("@/lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-client")>(
    "@/lib/api-client",
  );
  return {
    ...actual,
    getFilms: (params?: FilmsQueryParams) => mockGetFilms(params),
    getWatchlistGenres: () => mockGetWatchlistGenres(),
  };
});

const witch: FilmSummary = {
  id: "film-1",
  title: "The Witch",
  year: 2015,
  letterboxd_uri: "https://letterboxd.com/film/the-witch/",
  status: "active",
  enrichment_status: "ready",
  poster_url: null,
  director: null,
  runtime: 92,
  genres: ["Horror"],
  backdrop_url: null,
  latest_score: null,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

function page(total: number, films: FilmSummary[] = [witch], hasMore = false) {
  return {
    data: films,
    pagination: { total, limit: 18, offset: 0, has_more: hasMore },
  };
}

function renderPage() {
  const { Wrapper } = createQueryWrapper();
  return render(
    <Wrapper>
      <WatchlistPageContent />
    </Wrapper>,
  );
}

describe("WatchlistPageContent", () => {
  beforeAll(() => {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.scrollIntoView = () => {};
  });

  beforeEach(() => {
    mockReplace.mockReset();
    mockGetFilms.mockReset();
    mockGetWatchlistGenres.mockReset();
    searchParams = new URLSearchParams();
    mockGetWatchlistGenres.mockResolvedValue({ data: ["Horror", "Drama"] });
    mockGetFilms.mockImplementation(async (params?: FilmsQueryParams) => {
      if (params?.limit === 1) {
        const narrowed = params.runtime === "le_90" || (params.genres?.length ?? 0) > 0;
        return page(narrowed ? 4 : 239, []);
      }
      if (params?.status === "watched") return page(2, []);
      if (params?.status === "archived") return page(0, []);
      return page(239);
    });
  });

  afterEach(() => {
    cleanup();
    document.body.style.pointerEvents = "";
    delete (window as { matchMedia?: unknown }).matchMedia;
  });

  it("shows Unwatched, Watched and Archived with no counts and the view total", async () => {
    renderPage();

    expect(await screen.findByText("239 unwatched")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Unwatched" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Watched" })).toHaveTextContent("Watched");
    expect(screen.getByRole("tab", { name: "Archived" })).toHaveTextContent("Archived");
    expect(screen.getByRole("tab", { name: "Unwatched" }).textContent).toBe("Unwatched");
    expect(screen.getByText("The Witch")).toBeInTheDocument();
    expect(screen.getByText("2015 · 92m")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Previous" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Add film" })).not.toBeInTheDocument();

    expect(mockGetFilms).toHaveBeenCalledTimes(1);
    expect(mockGetFilms).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "active",
        sort: "created_at",
        sort_dir: "desc",
        limit: 18,
        offset: 0,
      }),
    );
    expect(mockGetFilms.mock.calls[0][0]).not.toHaveProperty("on_watchlist");
  });

  it("crossfades a pill change at 400ms out, 600ms in, overlapping by 200ms", async () => {
    renderPage();
    await screen.findByText("239 unwatched");
    const node = document.querySelector("[data-cb-watchlist-crossfade]");
    expect(node).toHaveAttribute("data-out-ms", "400");
    expect(node).toHaveAttribute("data-in-ms", "600");
    expect(node).toHaveAttribute("data-delay-ms", "200");
  });

  it("uses a 300ms crossfade when motion is reduced", async () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      get matches() {
        return query.includes("prefers-reduced-motion");
      },
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    renderPage();
    await screen.findByText("239 unwatched");
    await waitFor(() => {
      const node = document.querySelector("[data-cb-watchlist-crossfade]");
      expect(node).toHaveAttribute("data-out-ms", "300");
      expect(node).toHaveAttribute("data-in-ms", "300");
      expect(node).toHaveAttribute("data-delay-ms", "0");
    });
  });

  it("switches the view without an offset param", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("239 unwatched");

    await user.click(screen.getByRole("tab", { name: "Watched" }));
    expect(mockReplace).toHaveBeenCalledWith("/watchlist?tab=watched");

    mockReplace.mockClear();
    searchParams = new URLSearchParams("tab=watched");
    cleanup();
    renderPage();
    await screen.findByText("2 watched");
    await user.click(screen.getByRole("tab", { name: "Archived" }));
    expect(String(mockReplace.mock.calls.at(-1)?.[0])).toBe("/watchlist?tab=archived");
  });

  it("drops a page offset and an unknown sort", async () => {
    searchParams = new URLSearchParams("offset=36&sort=watched_at&sort_dir=asc");
    renderPage();
    await screen.findByText("239 unwatched");
    expect(mockGetFilms).toHaveBeenCalledWith(
      expect.objectContaining({ offset: 0, sort: "created_at", sort_dir: "desc" }),
    );
    expect(mockReplace).toHaveBeenCalledWith("/watchlist");
  });

  it("shows Loading more while the next 18 are in flight", async () => {
    let release: (value: ReturnType<typeof page>) => void = () => undefined;
    mockGetFilms.mockImplementation((params?: FilmsQueryParams) => {
      if ((params?.offset ?? 0) > 0) {
        return new Promise<ReturnType<typeof page>>((resolve) => {
          release = resolve;
        });
      }
      return Promise.resolve(page(40, [witch], true));
    });
    renderPage();
    expect(await screen.findByRole("status")).toHaveTextContent("Loading more");
    release(page(40, [], false));
    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });

  it("shows an error state when the list cannot load", async () => {
    mockGetFilms.mockRejectedValue(new Error("offline"));
    renderPage();
    expect(await screen.findByText("Could not load watchlist.")).toBeInTheDocument();
  });

  it("applies a runtime limit and genre from the filter sheet", async () => {
    const user = userEvent.setup();
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      get matches() {
        return query.includes("prefers-reduced-motion");
      },
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    renderPage();
    await screen.findByText("239 unwatched");

    await user.click(screen.getByRole("button", { name: "Filter" }));
    await user.click(await screen.findByRole("button", { name: "Horror" }));
    await user.click(screen.getByRole("radio", { name: "≤ 90 minutes" }));
    await user.click(await screen.findByRole("button", { name: "Show 4 films" }));

    const url = String(mockReplace.mock.calls.at(-1)?.[0]);
    expect(url).toContain("genres=Horror");
    expect(url).toContain("runtime=le_90");
    expect(url).not.toContain("offset=");
  });

  it("sets sort and sort_dir from the sort sheet", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("239 unwatched");
    expect(screen.getByRole("button", { name: "Sort by Date added" })).toHaveTextContent(
      "Date added",
    );

    await user.click(screen.getByRole("button", { name: "Sort by Date added" }));
    await user.click(await screen.findByRole("option", { name: /Rating/ }));
    expect(String(mockReplace.mock.calls.at(-1)?.[0])).toBe(
      "/watchlist?sort=rating&sort_dir=desc",
    );
  });

  it("says when a view is empty", async () => {
    mockGetFilms.mockResolvedValue(page(0, []));
    renderPage();
    expect(await screen.findByText(/Nothing on your watchlist yet/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Import your watchlist" })).toHaveAttribute(
      "href",
      "/import",
    );

    cleanup();
    searchParams = new URLSearchParams("tab=archived");
    mockGetFilms.mockResolvedValue(page(0, []));
    renderPage();
    expect(await screen.findByText("No archived films.")).toBeInTheDocument();
    expect(screen.getByText("0 archived")).toBeInTheDocument();
  });
});
