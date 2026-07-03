import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { createQueryWrapper } from "@/test/query-wrapper";
import { useCreateRecommendation, useDeleteRecommendation } from "@/hooks/use-recommendations";
import { DEFAULT_QUESTIONNAIRE } from "@/lib/questionnaire-vocabulary";

const { postRecommendationMock, deleteRecommendationMock } = vi.hoisted(() => ({
  postRecommendationMock: vi.fn(),
  deleteRecommendationMock: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({
  postRecommendation: postRecommendationMock,
  getRecommendation: vi.fn(),
  listRecommendations: vi.fn(),
  deleteRecommendation: deleteRecommendationMock,
}));

describe("useCreateRecommendation", () => {
  it("invalidates history cache after creating a session", async () => {
    postRecommendationMock.mockResolvedValue({
      session_id: "session-1",
      winner: null,
      runners_up: [],
      constraint_relaxations: [],
    });

    const { Wrapper, invalidateQueries } = createQueryWrapper();
    const { result } = renderHook(() => useCreateRecommendation(), {
      wrapper: Wrapper,
    });

    await result.current.mutateAsync({
      questionnaire: {
        ...DEFAULT_QUESTIONNAIRE,
        genres: ["Horror"],
        emotional_outcomes: ["Disturbed"],
        visual_tonal_vibes: ["Atmospheric"],
      },
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["recommendations", "history"],
    });
  });
});

describe("useDeleteRecommendation", () => {
  it("invalidates history cache and removes session query after delete", async () => {
    deleteRecommendationMock.mockResolvedValue(undefined);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
    const removeQueries = vi.spyOn(queryClient, "removeQueries");

    function Wrapper({ children }: { children: React.ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );
    }

    const { result } = renderHook(() => useDeleteRecommendation(), {
      wrapper: Wrapper,
    });

    await result.current.mutateAsync("session-to-delete");

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(deleteRecommendationMock).toHaveBeenCalledWith("session-to-delete");
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["recommendations", "history"],
    });
    expect(removeQueries).toHaveBeenCalledWith({
      queryKey: ["recommendations", "session-to-delete"],
    });
  });
});
