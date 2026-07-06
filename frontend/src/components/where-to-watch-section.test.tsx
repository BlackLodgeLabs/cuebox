import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WhereToWatchSection } from "@/components/where-to-watch-section";
import { ApiClientError } from "@/lib/api-client";

const { useFilmWatchProvidersMock } = vi.hoisted(() => ({
  useFilmWatchProvidersMock: vi.fn(),
}));

vi.mock("@/hooks/use-watch-providers", () => ({
  useFilmWatchProviders: useFilmWatchProvidersMock,
}));

vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <div>{alt || "logo"}</div>,
}));

const populatedData = {
  film_id: "film-1",
  tmdb_id: 603,
  country_code: "GB",
  link: "https://www.themoviedb.org/movie/603/watch?locale=GB",
  categories: [
    {
      type: "flatrate" as const,
      label: "Stream" as const,
      providers: [
        {
          provider_id: 8,
          provider_name: "Netflix",
          logo_url: "https://image.tmdb.org/t/p/w92/netflix.jpg",
          display_priority: 1,
        },
      ],
    },
    {
      type: "rent" as const,
      label: "Rent" as const,
      providers: [
        {
          provider_id: 2,
          provider_name: "Apple TV",
          logo_url: "https://image.tmdb.org/t/p/w92/apple.jpg",
          display_priority: 2,
        },
      ],
    },
  ],
};

describe("WhereToWatchSection", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows loading skeleton while fetching", () => {
    useFilmWatchProvidersMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    const { container } = render(
      <WhereToWatchSection filmId="film-1" hasTmdbId />,
    );

    expect(screen.getByText("Where to Watch")).toBeInTheDocument();
    expect(container.querySelector(".bg-surface-high")).toBeTruthy();
  });

  it("renders populated categories and JustWatch attribution", () => {
    useFilmWatchProvidersMock.mockReturnValue({
      data: populatedData,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<WhereToWatchSection filmId="film-1" hasTmdbId />);

    expect(screen.getByText("Stream")).toBeInTheDocument();
    expect(screen.getByText("Netflix")).toBeInTheDocument();
    expect(screen.getByText("Rent")).toBeInTheDocument();
    expect(
      screen.getByText("Streaming data provided by JustWatch via TMDB."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view on tmdb/i })).toHaveAttribute(
      "href",
      populatedData.link,
    );
  });

  it("shows UK empty-state when categories are empty", () => {
    useFilmWatchProvidersMock.mockReturnValue({
      data: { ...populatedData, categories: [] },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<WhereToWatchSection filmId="film-1" hasTmdbId />);

    expect(
      screen.getByText("No streaming options currently listed for the UK."),
    ).toBeInTheDocument();
  });

  it("shows guidance when film has no tmdb id", () => {
    render(
      <WhereToWatchSection
        filmId="film-1"
        hasTmdbId={false}
        onEditMatch={vi.fn()}
      />,
    );

    expect(
      screen.getByText("Match TMDB metadata to see streaming options."),
    ).toBeInTheDocument();
    expect(useFilmWatchProvidersMock).toHaveBeenCalledWith("film-1", {
      enabled: false,
    });
  });

  it("shows guidance on UNPROCESSABLE API error", () => {
    useFilmWatchProvidersMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new ApiClientError({
        code: "UNPROCESSABLE",
        message: "Match TMDB metadata to see streaming options.",
      }),
      refetch: vi.fn(),
    });

    render(
      <WhereToWatchSection filmId="film-1" hasTmdbId onEditMatch={vi.fn()} />,
    );

    expect(
      screen.getByText("Match TMDB metadata to see streaming options."),
    ).toBeInTheDocument();
  });

  it("shows retry on generic errors", async () => {
    const refetch = vi.fn();
    useFilmWatchProvidersMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("network"),
      refetch,
    });

    render(<WhereToWatchSection filmId="film-1" hasTmdbId />);

    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(refetch).toHaveBeenCalled();
  });
});
