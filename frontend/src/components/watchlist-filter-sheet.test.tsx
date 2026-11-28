import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_WATCHLIST_FILTERS,
  WatchlistFilterSheet,
} from "@/components/watchlist-filter-sheet";
import { RUNTIME_OPTIONS } from "@/lib/questionnaire-vocabulary";
import { createQueryWrapper } from "@/test/query-wrapper";
import type { FilmsQueryParams } from "@/types/api";

const { mockGetFilms, mockGetWatchlistGenres } = vi.hoisted(() => ({
  mockGetFilms: vi.fn(),
  mockGetWatchlistGenres: vi.fn(),
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

function mockReduced(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    get matches() {
      return query.includes("prefers-reduced-motion") ? matches : false;
    },
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

describe("WatchlistFilterSheet", () => {
  beforeAll(() => {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.scrollIntoView = () => {};
  });

  afterEach(() => {
    cleanup();
    document.body.style.pointerEvents = "";
    delete (window as { matchMedia?: unknown }).matchMedia;
  });

  it("offers one runtime choice from RUNTIME_OPTIONS, defaulting to No limit", async () => {
    mockReduced(true);
    mockGetWatchlistGenres.mockResolvedValue({ data: ["Horror", "Drama"] });
    mockGetFilms.mockResolvedValue({
      data: [],
      pagination: { total: 11, limit: 1, offset: 0, has_more: false },
    });
    const { Wrapper } = createQueryWrapper();

    render(
      <Wrapper>
        <WatchlistFilterSheet
          open
          onOpenChange={vi.fn()}
          status="active"
          values={DEFAULT_WATCHLIST_FILTERS}
          onApply={vi.fn()}
        />
      </Wrapper>,
    );

    for (const option of RUNTIME_OPTIONS) {
      expect(screen.getByRole("radio", { name: option.label })).toBeInTheDocument();
    }
    expect(screen.getByRole("radio", { name: "No limit" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("radio", { name: "≤ 90 minutes" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(screen.getByRole("switch", { name: /On my services/i })).toHaveAttribute(
      "data-state",
      "unchecked",
    );
    expect(await screen.findByRole("button", { name: "Horror" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Search$/i)).not.toBeInTheDocument();
  });

  it("previews pagination.total for the pending filters and applies that choice", async () => {
    const user = userEvent.setup();
    mockReduced(true);
    mockGetWatchlistGenres.mockResolvedValue({ data: ["Horror", "Drama"] });
    mockGetFilms.mockImplementation(async (params?: FilmsQueryParams) => {
      const total = params?.runtime === "le_90" ? 4 : 11;
      return {
        data: [],
        pagination: { total, limit: 1, offset: 0, has_more: false },
      };
    });
    const onApply = vi.fn();
    const { Wrapper } = createQueryWrapper();

    render(
      <Wrapper>
        <WatchlistFilterSheet
          open
          onOpenChange={vi.fn()}
          status="watched"
          values={{ genres: ["Drama"], runtime: "any", onMyServices: false }}
          onApply={onApply}
        />
      </Wrapper>,
    );

    await screen.findByRole("button", { name: "Show 11 films" });
    expect(mockGetFilms).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "watched",
        genres: ["Drama"],
        limit: 1,
      }),
    );
    expect(mockGetFilms.mock.calls.at(-1)?.[0]).not.toHaveProperty("runtime");

    await user.click(screen.getByRole("radio", { name: "≤ 90 minutes" }));
    await screen.findByRole("button", { name: "Show 4 films" });
    await waitFor(() => {
      const number = document.querySelector("[data-cb-number]");
      expect(number).toHaveAttribute("data-duration-ms", "0");
      expect(number).toHaveTextContent("4");
    });

    await user.click(screen.getByRole("button", { name: "Show 4 films" }));
    expect(onApply).toHaveBeenCalledWith({
      genres: ["Drama"],
      runtime: "le_90",
      onMyServices: false,
    });
  });

  it("Clear all returns the draft to No limit and no genres without applying", async () => {
    const user = userEvent.setup();
    mockReduced(true);
    mockGetWatchlistGenres.mockResolvedValue({ data: ["Horror"] });
    mockGetFilms.mockImplementation(async (params?: FilmsQueryParams) => ({
      data: [],
      pagination: {
        total: params?.runtime === "le_120" || (params?.genres && params.genres.length > 0) ? 2 : 9,
        limit: 1,
        offset: 0,
        has_more: false,
      },
    }));
    const onApply = vi.fn();
    const { Wrapper } = createQueryWrapper();

    render(
      <Wrapper>
        <WatchlistFilterSheet
          open
          onOpenChange={vi.fn()}
          status="active"
          values={{ genres: ["Horror"], runtime: "le_120", onMyServices: true }}
          onApply={onApply}
        />
      </Wrapper>,
    );

    await screen.findByRole("button", { name: "Show 2 films" });
    await user.click(screen.getByRole("button", { name: "Clear all" }));
    expect(screen.getByRole("radio", { name: "No limit" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Horror" }).className).not.toMatch(
        /text-cb-teal/,
      );
    });
    expect(onApply).not.toHaveBeenCalled();
    expect(screen.getByRole("switch", { name: /On my services/i })).toHaveAttribute(
      "data-state",
      "unchecked",
    );
    await screen.findByRole("button", { name: "Show 9 films" });
  });

  it("counts films on my services when the switch is on", async () => {
    const user = userEvent.setup();
    mockReduced(true);
    mockGetWatchlistGenres.mockResolvedValue({ data: ["Horror"] });
    mockGetFilms.mockImplementation(async (params?: FilmsQueryParams) => ({
      data: [],
      pagination: {
        total: params?.on_my_services ? 4 : 11,
        limit: 1,
        offset: 0,
        has_more: false,
      },
    }));
    const onApply = vi.fn();
    const { Wrapper } = createQueryWrapper();

    render(
      <Wrapper>
        <WatchlistFilterSheet
          open
          onOpenChange={vi.fn()}
          status="active"
          values={DEFAULT_WATCHLIST_FILTERS}
          onApply={onApply}
        />
      </Wrapper>,
    );

    await screen.findByRole("button", { name: "Show 11 films" });
    await user.click(screen.getByRole("switch", { name: /On my services/i }));
    await screen.findByRole("button", { name: "Show 4 films" });
    expect(mockGetFilms).toHaveBeenCalledWith(
      expect.objectContaining({ status: "active", on_my_services: true, limit: 1 }),
    );
    await user.click(screen.getByRole("button", { name: "Show 4 films" }));
    expect(onApply).toHaveBeenCalledWith({
      genres: [],
      runtime: "any",
      onMyServices: true,
    });
  });

  it("still applies when the preview count fails", async () => {
    mockReduced(true);
    mockGetWatchlistGenres.mockResolvedValue({ data: [] });
    mockGetFilms.mockRejectedValue(new Error("offline"));
    const onApply = vi.fn();
    const { Wrapper } = createQueryWrapper();

    render(
      <Wrapper>
        <WatchlistFilterSheet
          open
          onOpenChange={vi.fn()}
          status="active"
          values={DEFAULT_WATCHLIST_FILTERS}
          onApply={onApply}
        />
      </Wrapper>,
    );

    const show = await screen.findByRole("button", { name: "Show films" });
    await waitFor(() => expect(show).toBeEnabled());
    await userEvent.click(show);
    expect(onApply).toHaveBeenCalledWith(DEFAULT_WATCHLIST_FILTERS);
  });
});
