import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createQueryWrapper } from "@/test/query-wrapper";
import { useCreateRecommendation } from "@/hooks/use-recommendations";
import { DEFAULT_QUESTIONNAIRE } from "@/lib/questionnaire-vocabulary";

const { postRecommendationMock } = vi.hoisted(() => ({
  postRecommendationMock: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({
  postRecommendation: postRecommendationMock,
  getRecommendation: vi.fn(),
  listRecommendations: vi.fn(),
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
