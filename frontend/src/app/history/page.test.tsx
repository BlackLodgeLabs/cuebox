import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import HistoryPage from "@/app/history/page";
import { createQueryWrapper } from "@/test/query-wrapper";

const {
  useRecommendationHistoryMock,
  useDeleteRecommendationMock,
} = vi.hoisted(() => ({
  useRecommendationHistoryMock: vi.fn(),
  useDeleteRecommendationMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/hooks/use-toast-on-error", () => ({
  useToastOnError: () => vi.fn(),
}));

vi.mock("@/hooks/use-recommendations", () => ({
  useRecommendationHistory: (...args: unknown[]) =>
    useRecommendationHistoryMock(...args),
  useDeleteRecommendation: () => useDeleteRecommendationMock(),
}));

vi.mock("@/components/delete-history-dialog", () => ({
  DeleteHistoryDialog: () => null,
}));

function mockHistoryLoaded() {
  useDeleteRecommendationMock.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  });
  useRecommendationHistoryMock.mockReturnValue({
    data: {
      data: [
        {
          session_id: "session-1",
          winner_film_id: "film-1",
          winner_title: "Test Film",
          winner_year: 2000,
          winner_poster_url: null,
          winner_watch_status: "active",
          preference_summary: "A pick.",
          created_at: "2024-01-01T00:00:00Z",
        },
      ],
      pagination: { total: 1, limit: 20, offset: 0, has_more: false },
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
}

function renderHistory() {
  const { Wrapper } = createQueryWrapper();
  return render(
    <Wrapper>
      <HistoryPage />
    </Wrapper>,
  );
}

describe("HistoryPage touch targets", () => {
  afterEach(() => {
    cleanup();
    useRecommendationHistoryMock.mockReset();
    useDeleteRecommendationMock.mockReset();
  });

  it("remove control uses ≥44×44 hit area with ghost weight", () => {
    mockHistoryLoaded();
    renderHistory();

    expect(screen.getByRole("link", { name: /← home/i })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: /← home/i }).className).toMatch(
      /min-h-11/,
    );

    const remove = screen.getByRole("button", { name: /remove from history/i });
    expect(remove.className).toMatch(/min-h-11/);
    expect(remove.className).toMatch(/min-w-11/);
    expect(remove.className).toMatch(/text-muted-foreground/);
  });
});

describe("HistoryPage filter disclosure", () => {
  afterEach(() => {
    cleanup();
    useRecommendationHistoryMock.mockReset();
    useDeleteRecommendationMock.mockReset();
  });

  it("keeps date/status controls behind Filter until opened", async () => {
    const user = userEvent.setup();
    mockHistoryLoaded();
    renderHistory();

    expect(screen.getByRole("button", { name: /filter history/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/search by title/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^from$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^to$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/watch status/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /filter history/i }));

    expect(screen.getByLabelText(/^from$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^to$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/watch status/i)).toBeInTheDocument();
  });

  it("applies and clears date/status filters through the sheet", async () => {
    const user = userEvent.setup();
    mockHistoryLoaded();
    renderHistory();

    await user.click(screen.getByRole("button", { name: /filter history/i }));
    await user.type(screen.getByLabelText(/^from$/i), "2024-01-01");
    await user.click(screen.getByRole("button", { name: /^apply$/i }));

    await waitFor(() => {
      expect(useRecommendationHistoryMock).toHaveBeenCalledWith(
        expect.objectContaining({
          date_from: "2024-01-01",
        }),
      );
    });

    const filterButton = screen.getByRole("button", { name: /filter history/i });
    expect(filterButton.className).toMatch(/border-primary/);
    expect(filterButton.className).toMatch(/text-primary/);

    await user.click(filterButton);
    await user.click(screen.getByRole("button", { name: /^clear$/i }));

    await waitFor(() => {
      expect(useRecommendationHistoryMock).toHaveBeenCalledWith(
        expect.objectContaining({
          date_from: undefined,
          date_to: undefined,
          watch_status: undefined,
        }),
      );
    });
  });
});
