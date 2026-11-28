import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RecommendPage from "@/app/recommend/page";
import { ApiClientError, postRecommendation } from "@/lib/api-client";
import { createQueryWrapper } from "@/test/query-wrapper";
import type { RecommendationResponse } from "@/types/api";

const pushMock = vi.fn();
const replaceMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
  usePathname: () => "/recommend",
}));

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return {
    ...actual,
    postRecommendation: vi.fn(),
    getFilms: vi.fn().mockResolvedValue({
      data: [
        {
          id: "watch-1",
          title: "Lamb",
          backdrop_url: "https://image.tmdb.org/t/p/w1280/lamb.jpg",
        },
      ],
      pagination: { total: 1, limit: 40, offset: 0, has_more: false },
    }),
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
    backdrop_url: "https://image.tmdb.org/t/p/w1280/winner.jpg",
    genres: ["Horror"],
    explanation: {
      why_it_matches: "Matches",
      most_influential_factors: ["theme"],
      why_it_beat_alternatives: null,
      caveats: null,
    },
  },
  runners_up: [],
};

function mockReducedMotion() {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes("prefers-reduced-motion"),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

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

  expect(screen.getByRole("button", { name: "Find my pick" })).toBeInTheDocument();
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
  beforeEach(() => {
    mockReducedMotion();
  });

  afterEach(() => {
    cleanup();
    postRecommendationMock.mockReset();
    pushMock.mockReset();
    replaceMock.mockReset();
  });

  it("shows one question at a time, with a mono counter and no tab bar", async () => {
    const user = userEvent.setup();
    renderRecommendPage();

    expect(
      screen.getByRole("heading", { name: "What genres are you in the mood for?" }),
    ).toBeInTheDocument();
    expect(screen.getByText("1 of 11")).toBeInTheDocument();
    expect(screen.getByLabelText("Question 1 of 11")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Skip" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Primary" })).not.toBeInTheDocument();

    const next = screen.getByRole("button", { name: "Next" });
    expect(next.className).toMatch(/h-11/);
    expect(screen.getByRole("button", { name: "Close" }).className).toMatch(/h-11/);
    expect(screen.getByRole("button", { name: "No Preference" }).className).toMatch(/min-h-11/);
    expect(screen.getByTestId("questionnaire-sticky-chrome")).toBeInTheDocument();

    for (let step = 0; step < 10; step += 1) {
      await user.click(screen.getByRole("button", { name: "Skip" }));
    }

    expect(
      screen.getByRole("heading", { name: "Anything else we should know?" }),
    ).toBeInTheDocument();
    expect(screen.getByText("11 of 11")).toBeInTheDocument();
    expect(screen.getByText("Optional")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Skip" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Find my pick" })).toBeInTheDocument();
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

  it("uses large single-choice cards on the runtime step", async () => {
    const user = userEvent.setup();
    renderRecommendPage();

    await user.click(screen.getByRole("button", { name: "No Preference" }));
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByRole("heading", { name: "How long do you want the film to be?" })).toBeInTheDocument();
    expect(screen.getByText("2 of 11")).toBeInTheDocument();
    const runtime = screen.getByRole("button", { name: /No limit/ });
    expect(runtime.className).toMatch(/min-h-\[72px\]/);
    expect(screen.getByText("Pick one to continue")).toBeInTheDocument();
  });

  it("crossfades to the results programme after the pick is ready", async () => {
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

    await user.click(screen.getByRole("button", { name: "Find my pick" }));
    expect(screen.queryByTestId("film-strip")).not.toBeInTheDocument();

    resolveMutation(mockRecommendationResponse);
    await waitFor(() => {
      expect(screen.getByTestId("recommend-reduced-crossfade")).toHaveAttribute(
        "data-reduced-crossfade-ms",
        "300",
      );
    });
    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/recommend/results/session-abc");
    }, { timeout: 2000 });

    expect(screen.queryByRole("button", { name: "Find my pick" })).not.toBeInTheDocument();
  });

  it("clears the cue and shows submit error with retry on API failure", async () => {
    const user = userEvent.setup();
    postRecommendationMock.mockRejectedValue(
      new ApiClientError({
        code: "INTERNAL_ERROR",
        message: "Could not rank films.",
      }),
    );

    renderRecommendPage();
    await advanceToNotesStep(user);

    await user.click(screen.getByRole("button", { name: "Find my pick" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Anything else we should know?" })).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Find my pick" })).toBeEnabled();
    expect(screen.getByText(/something went wrong on our end/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("shows reach copy and retry when the API is unreachable", async () => {
    const user = userEvent.setup();
    postRecommendationMock.mockRejectedValue(new TypeError("Failed to fetch"));

    renderRecommendPage();
    await advanceToNotesStep(user);

    await user.click(screen.getByRole("button", { name: "Find my pick" }));

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
          setTimeout(
            () => resolve({ ...mockRecommendationResponse, session_id: "session-once" }),
            50,
          );
        }),
    );

    renderRecommendPage();
    await advanceToNotesStep(user);

    const submitButton = screen.getByRole("button", { name: "Find my pick" });
    await user.click(submitButton);
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(postRecommendationMock).toHaveBeenCalledTimes(1);
    });
  });
});
