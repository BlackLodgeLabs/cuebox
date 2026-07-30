import { cleanup, render, screen } from "@testing-library/react";
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

    renderHistory();

    const remove = screen.getByRole("button", { name: /remove from history/i });
    expect(remove.className).toMatch(/min-h-11/);
    expect(remove.className).toMatch(/min-w-11/);
    expect(remove.className).toMatch(/text-muted-foreground/);
  });
});
