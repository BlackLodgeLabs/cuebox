import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import RecommendPage from "@/app/recommend/page";
import { ApiClientError, postRecommendation } from "@/lib/api-client";
import { createQueryWrapper } from "@/test/query-wrapper";
import type { RecommendationResponse } from "@/types/api";

const pushMock = vi.fn();
const replaceMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
}));

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return {
    ...actual,
    postRecommendation: vi.fn(),
  };
});

const postRecommendationMock = vi.mocked(postRecommendation);

const mockRecommendationResponse: RecommendationResponse = {
  session_id: "session-abc",
  profile_id: "profile-1",
  profile_cache_hit: false,
  constraint_relaxation: null,
  created_at: "2024-01-01T00:00:00Z",
  winner: {
    film_id: "film-1",
    title: "Test Film",
    year: 2000,
    runtime: 100,
    director: "Director",
    synopsis: "Synopsis",
    letterboxd_rating: 4,
    tmdb_rating: 7,
    rotten_tomatoes_score: 90,
    poster_url: null,
    explanation: {
      why_it_matches: "Matches",
      most_influential_factors: ["theme"],
      why_it_beat_alternatives: null,
      caveats: null,
    },
  },
  runners_up: [],
};

async function advanceToNotesStep(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "No Preference" }));
  await user.click(screen.getByRole("button", { name: "Next" }));

  for (let i = 0; i < 4; i++) {
    await user.click(screen.getByRole("button", { name: "Next" }));
  }

  await user.click(screen.getAllByRole("button", { name: "No Preference" })[0]);
  await user.click(screen.getByRole("button", { name: "Next" }));

  await user.click(screen.getAllByRole("button", { name: "No Preference" })[0]);
  await user.click(screen.getByRole("button", { name: "Next" }));

  for (let i = 0; i < 3; i++) {
    await user.click(screen.getByRole("button", { name: "Next" }));
  }

  expect(
    screen.getByRole("button", { name: "Get recommendation" }),
  ).toBeInTheDocument();
}

function renderRecommendPage() {
  const { Wrapper } = createQueryWrapper();
  return render(
    <Wrapper>
      <RecommendPage />
    </Wrapper>,
  );
}

describe("RecommendPage", () => {
  afterEach(() => {
    cleanup();
    postRecommendationMock.mockReset();
    pushMock.mockReset();
    replaceMock.mockReset();
  });

  it("shows a single title stack, progress cue, and ≥44px nav controls", () => {
    renderRecommendPage();

    expect(screen.getByRole("heading", { name: "Genres", level: 1 })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: "Genres" })).toHaveLength(1);
    expect(screen.getByText(/step 1 of 11/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/questionnaire progress, step 1 of 11/i),
    ).toBeInTheDocument();

    const next = screen.getByRole("button", { name: "Next" });
    const back = screen.getByRole("button", { name: "Back" });
    expect(next.className).toMatch(/min-h-11/);
    expect(back.className).toMatch(/min-h-11/);

    const chip = screen.getByRole("button", { name: "No Preference" });
    expect(chip.className).toMatch(/min-h-11/);

    const content = screen.getByTestId("questionnaire-content");
    expect(content.className).toMatch(/pb-24/);
    expect(screen.getByTestId("questionnaire-sticky-chrome")).toBeInTheDocument();
  });

  it("scrolls notes into view on focus", async () => {
    const user = userEvent.setup();
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;

    renderRecommendPage();
    await advanceToNotesStep(user);

    const notes = screen.getByTestId("questionnaire-notes");
    await user.click(notes);

    expect(scrollIntoView).toHaveBeenCalledWith({ block: "center" });
  });

  it("uses ≥44px radio option rows on runtime step", async () => {
    const user = userEvent.setup();
    renderRecommendPage();

    await user.click(screen.getByRole("button", { name: "No Preference" }));
    await user.click(screen.getByRole("button", { name: "Next" }));

    const runtimeLabel = screen.getByText("No limit").closest("label");
    expect(runtimeLabel?.className).toMatch(/min-h-11/);
  });

  it("keeps loading UI visible after mutation settles but before navigation completes", async () => {
    const user = userEvent.setup();
    let resolveMutation!: (value: RecommendationResponse) => void;
    postRecommendationMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveMutation = resolve;
        }),
    );

    renderRecommendPage();
    await advanceToNotesStep(user);

    await user.click(screen.getByRole("button", { name: "Get recommendation" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /finding your film/i })).toBeInTheDocument();
    });

    resolveMutation(mockRecommendationResponse);
    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith(
        "/recommend/results/session-abc?stage=1",
      );
    });

    expect(screen.getByRole("heading", { name: /finding your film/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Get recommendation" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Notes" })).not.toBeInTheDocument();
  });

  it("clears loading and shows submit error with retry on API failure", async () => {
    const user = userEvent.setup();
    postRecommendationMock.mockRejectedValue(
      new ApiClientError({
        code: "INTERNAL_ERROR",
        message: "Could not rank films.",
      }),
    );

    renderRecommendPage();
    await advanceToNotesStep(user);

    await user.click(screen.getByRole("button", { name: "Get recommendation" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Notes" })).toBeInTheDocument();
    });
    expect(screen.queryByRole("heading", { name: /finding your film/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Get recommendation" })).toBeEnabled();
    expect(screen.getByText(/something went wrong on our end/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("shows reach copy and retry when the API is unreachable", async () => {
    const user = userEvent.setup();
    postRecommendationMock.mockRejectedValue(new TypeError("Failed to fetch"));

    renderRecommendPage();
    await advanceToNotesStep(user);

    await user.click(screen.getByRole("button", { name: "Get recommendation" }));

    await waitFor(() => {
      expect(
        screen.getByText(/could not reach the api\. make sure the backend is running/i),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("calls postRecommendation only once on rapid double-click", async () => {
    const user = userEvent.setup();
    postRecommendationMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ ...mockRecommendationResponse, session_id: "session-once" }), 50);
        }),
    );

    renderRecommendPage();
    await advanceToNotesStep(user);

    const submitButton = screen.getByRole("button", { name: "Get recommendation" });
    await user.click(submitButton);
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(postRecommendationMock).toHaveBeenCalledTimes(1);
    });
  });
});
