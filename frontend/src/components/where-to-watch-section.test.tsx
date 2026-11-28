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

    expect(container.querySelector(".animate-pulse")).toBeTruthy();
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

    expect(screen.getAllByText("Stream").length).toBeGreaterThan(0);
    expect(screen.getByText("Netflix")).toBeInTheDocument();
    expect(screen.getAllByText("Rent").length).toBeGreaterThan(0);
    expect(
      screen.getByText("Streaming data provided by JustWatch via TMDB."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view on tmdb/i })).toHaveAttribute(
      "href",
      populatedData.link,
    );
  });

  it("lists the user's services first under Ready to play", () => {
    useFilmWatchProvidersMock.mockReturnValue({
      data: {
        ...populatedData,
        categories: [
          {
            ...populatedData.categories[0],
            providers: [
              { ...populatedData.categories[0].providers[0], subscribed: false },
              {
                provider_id: 9,
                provider_name: "Prime Video",
                logo_url: null,
                display_priority: 2,
                subscribed: true,
              },
            ],
          },
          {
            ...populatedData.categories[1],
            providers: [
              {
                provider_id: 130,
                provider_name: "Sky Store",
                logo_url: null,
                display_priority: 3,
                subscribed: true,
              },
              ...populatedData.categories[1].providers,
            ],
          },
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<WhereToWatchSection filmId="film-1" hasTmdbId />);

    const names = screen
      .getAllByText(/Netflix|Prime Video|Apple TV|Sky Store/)
      .map((node) => node.textContent);
    expect(names[0]).toBe("Prime Video");
    expect(names.indexOf("Sky Store")).toBeGreaterThan(names.indexOf("Netflix"));
    const ready = screen.getByRole("heading", { name: "Ready to play" });
    expect(ready.nextElementSibling?.className).toContain("bg-cb-teal");
    expect(screen.getByText("Others")).toBeInTheDocument();
    expect(screen.getByText("My services")).toBeInTheDocument();
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
