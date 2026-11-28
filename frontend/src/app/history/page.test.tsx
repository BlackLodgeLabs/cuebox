import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import HistoryPage from "@/app/history/page";
import { createQueryWrapper } from "@/test/query-wrapper";
import type { HistoryCard, HistoryQueryParams, PaginatedResponse } from "@/types/api";

const { listRecommendationsMock, deleteRecommendationMock, pushMock } = vi.hoisted(() => ({
  listRecommendationsMock: vi.fn(),
  deleteRecommendationMock: vi.fn(),
  pushMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => "/history",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return {
    ...actual,
    listRecommendations: (params?: HistoryQueryParams) => listRecommendationsMock(params),
    deleteRecommendation: (sessionId: string) => deleteRecommendationMock(sessionId),
  };
});

function card(overrides: Partial<HistoryCard> = {}): HistoryCard {
  return {
    session_id: "session-1",
    winner_film_id: "film-1",
    winner_title: "The Witch",
    winner_year: 2015,
    winner_poster_url: "https://image.tmdb.org/t/p/w500/witch.jpg",
    winner_watch_status: "active",
    history_status_tag: "active",
    preference_summary: "Slow, unsettling, under two hours.",
    created_at: "2026-11-14T20:41:00.000Z",
    ...overrides,
  };
}

function page(
  data: HistoryCard[],
  pagination: Partial<PaginatedResponse<HistoryCard>["pagination"]> = {},
): PaginatedResponse<HistoryCard> {
  return {
    data,
    pagination: {
      total: pagination.total ?? data.length,
      limit: pagination.limit ?? 10,
      offset: pagination.offset ?? 0,
      has_more: pagination.has_more ?? false,
    },
  };
}

function renderHistory() {
  const { Wrapper } = createQueryWrapper();
  return render(
    <Wrapper>
      <HistoryPage />
    </Wrapper>,
  );
}

describe("HistoryPage ticket list", () => {
  afterEach(() => {
    cleanup();
    listRecommendationsMock.mockReset();
    deleteRecommendationMock.mockReset();
    pushMock.mockReset();
  });

  it("shows History, the night count, and a ticket stub without page buttons", async () => {
    listRecommendationsMock.mockResolvedValue(
      page(
        [
          card(),
          card({
            session_id: "session-2",
            winner_title: "Lamb",
            winner_year: 2021,
            preference_summary: "Folk horror, seeking unease.",
            created_at: "2026-10-02T21:00:00.000Z",
            winner_watch_status: "watched",
            history_status_tag: "watched",
          }),
        ],
        { total: 24, has_more: false },
      ),
    );

    renderHistory();

    expect(await screen.findByRole("heading", { name: "History" })).toBeInTheDocument();
    expect(await screen.findByText("24 nights")).toBeInTheDocument();
    expect(screen.getByLabelText(/search by title/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /filter history/i })).toBeInTheDocument();

    expect(screen.getByText(/november 2026/i)).toBeInTheDocument();
    expect(screen.getByText(/october 2026/i)).toBeInTheDocument();

    const witch = screen.getByRole("button", { name: /The Witch/ });
    expect(witch).toHaveTextContent("SAT");
    expect(witch).toHaveTextContent("14");
    expect(witch).toHaveTextContent("NOV");
    expect(witch).toHaveTextContent("2015");
    expect(witch).toHaveTextContent("Slow, unsettling, under two hours.");
    expect(witch).toHaveTextContent("Unwatched");
    expect(witch.querySelector("img")).toHaveAttribute(
      "src",
      "https://image.tmdb.org/t/p/w500/witch.jpg",
    );
    expect(witch.className).toContain("cb-press");
    expect(witch.className).not.toMatch(/shadow|glow|cb-accent/);

    expect(screen.getByRole("button", { name: /Lamb/ })).toHaveTextContent("Watched");
    expect(screen.queryByRole("button", { name: "Previous" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();

    await waitFor(() => {
      expect(listRecommendationsMock).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10, offset: 0 }),
      );
    });
  });

  it("says 1 night when the filtered total is one", async () => {
    listRecommendationsMock.mockResolvedValue(page([card()], { total: 1 }));
    renderHistory();
    expect(await screen.findByText("1 night")).toBeInTheDocument();
  });

  it("labels a runner-up that was watched later", async () => {
    listRecommendationsMock.mockResolvedValue(
      page([
        card({
          winner_watch_status: "active",
          history_status_tag: "runner_up_watched",
        }),
      ]),
    );
    renderHistory();
    expect(await screen.findByText("Runner-up watched")).toBeInTheDocument();
    expect(screen.queryByText("active")).not.toBeInTheDocument();
  });

  it("loads the next 10 nights from 600px and fades in a flat loading line", async () => {
    const viewport = 800;
    Object.defineProperty(window, "innerHeight", { configurable: true, value: viewport });
    Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
    Object.defineProperty(document.documentElement, "scrollHeight", {
      configurable: true,
      value: viewport + 100,
    });

    let releaseNext: () => void = () => {};
    const nextPage = new Promise<void>((resolve) => {
      releaseNext = resolve;
    });
    const first = Array.from({ length: 10 }, (_, index) =>
      card({
        session_id: `session-${index + 1}`,
        winner_title: index === 0 ? "The Witch" : `Night ${index + 1}`,
      }),
    );
    listRecommendationsMock.mockImplementation(async (params?: HistoryQueryParams) => {
      if ((params?.offset ?? 0) > 0) {
        await nextPage;
        return page(
          [card({ session_id: "session-11", winner_title: "Burning", winner_year: 2018 })],
          { total: 11, offset: 10, has_more: false },
        );
      }
      return page(first, { total: 11, has_more: true });
    });

    renderHistory();
    expect(await screen.findByText("The Witch")).toBeInTheDocument();

    await waitFor(() => {
      expect(listRecommendationsMock).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10, offset: 10 }),
      );
    });
    expect(screen.getByRole("status")).toHaveTextContent("Loading more");
    expect(screen.getByRole("status").className).toContain("text-cb-teal");
    expect(screen.getByRole("status").className).not.toMatch(/shadow|glow/);

    releaseNext();
    expect(await screen.findByText("Burning")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("keeps date and watch status in the filter sheet, including archived", async () => {
    const user = userEvent.setup();
    listRecommendationsMock.mockResolvedValue(page([card()], { total: 24 }));
    renderHistory();
    await screen.findByRole("heading", { name: "History" });

    expect(screen.queryByLabelText(/^from$/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /filter history/i }));
    expect(screen.getByLabelText(/^from$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^to$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/watch status/i)).toBeInTheDocument();
    Element.prototype.scrollIntoView = () => {};
    await user.click(screen.getByLabelText(/watch status/i));
    expect(await screen.findByRole("option", { name: "Archived" })).toBeInTheDocument();
    await user.keyboard("{Escape}");

    await user.type(screen.getByLabelText(/^from$/i), "2024-01-01");
    await user.click(screen.getByRole("button", { name: /^apply$/i }));

    await waitFor(() => {
      expect(listRecommendationsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          date_from: "2024-01-01",
          limit: 10,
          offset: 0,
        }),
      );
    });

    const filterButton = screen.getByRole("button", { name: /filter history/i });
    expect(filterButton.className).toMatch(/border-cb-teal/);
    expect(filterButton.className).toMatch(/text-cb-teal/);

    await user.click(filterButton);
    await user.click(screen.getByRole("button", { name: /^clear$/i }));

    await waitFor(() => {
      expect(listRecommendationsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          date_from: undefined,
          date_to: undefined,
          watch_status: undefined,
          limit: 10,
        }),
      );
    });
  });

  it("hides the Remove rail until a swipe, then asks before deleting", async () => {
    const user = userEvent.setup();
    listRecommendationsMock.mockResolvedValue(page([card(), card({ session_id: "keep", winner_title: "Lamb" })]));
    deleteRecommendationMock.mockResolvedValue(undefined);
    renderHistory();

    const ticket = await screen.findByRole("button", { name: /The Witch/ });
    const rail = ticket.parentElement?.querySelector("[data-remove-rail]");
    expect(rail).not.toBeNull();
    expect(rail).toHaveAttribute("data-revealed", "false");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    fireEvent.pointerDown(ticket, { clientX: 220, clientY: 40, button: 0, pointerId: 1 });
    fireEvent.pointerMove(ticket, { clientX: 120, clientY: 42, button: 0, pointerId: 1 });
    expect(ticket.parentElement?.querySelector("[data-remove-rail]")).toHaveAttribute(
      "data-revealed",
      "true",
    );
    fireEvent.pointerUp(ticket, { clientX: 120, clientY: 42, button: 0, pointerId: 1 });

    const dialog = await screen.findByRole("alertdialog", { name: /remove this night/i });
    expect(dialog).toHaveTextContent(/deleted from History/i);
    expect(deleteRecommendationMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /^remove$/i }));
    await waitFor(() => {
      expect(deleteRecommendationMock).toHaveBeenCalledWith("session-1");
    });
  });

  it("opens the same confirm on a long press and does not delete on cancel", async () => {
    const user = userEvent.setup();
    listRecommendationsMock.mockResolvedValue(page([card()]));
    deleteRecommendationMock.mockResolvedValue(undefined);
    renderHistory();

    const ticket = await screen.findByRole("button", { name: /The Witch/ });
    fireEvent.pointerDown(ticket, { clientX: 180, clientY: 40, button: 0, pointerId: 1 });
    await new Promise((resolve) => setTimeout(resolve, 560));

    expect(await screen.findByRole("alertdialog", { name: /remove this night/i })).toBeInTheDocument();
    expect(ticket.parentElement?.querySelector("[data-remove-rail]")).toHaveAttribute(
      "data-revealed",
      "false",
    );

    await user.click(screen.getByRole("button", { name: /^cancel$/i }));
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
    expect(deleteRecommendationMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("opens the dated night on a tap", async () => {
    listRecommendationsMock.mockResolvedValue(page([card()]));
    renderHistory();

    fireEvent.click(await screen.findByRole("button", { name: /The Witch/ }));
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/history/session-1");
    });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});
