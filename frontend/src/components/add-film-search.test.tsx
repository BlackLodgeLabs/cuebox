import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AddFilmSearch } from "@/components/add-film-search";
import { createQueryWrapper } from "@/test/query-wrapper";

const { searchTmdbGlobalMock } = vi.hoisted(() => ({
  searchTmdbGlobalMock: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({
  searchTmdbGlobal: searchTmdbGlobalMock,
}));

describe("AddFilmSearch", () => {
  it("searches TMDB and calls onConfirm with the selected result", async () => {
    searchTmdbGlobalMock.mockResolvedValue({
      data: [
        {
          tmdb_id: 603,
          title: "The Matrix",
          original_title: "The Matrix",
          year: 1999,
          overview: "A computer hacker learns about reality.",
          poster_url: "https://example.com/matrix.jpg",
        },
      ],
      pagination: { total: 1, limit: 20, offset: 0, has_more: false },
    });

    const onConfirm = vi.fn();
    const { Wrapper } = createQueryWrapper();

    render(<AddFilmSearch onConfirm={onConfirm} />, { wrapper: Wrapper });

    await userEvent.type(screen.getByLabelText("TMDB search query"), "Matrix");

    await waitFor(() => {
      expect(screen.getByText("The Matrix (1999)")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("The Matrix (1999)"));
    await userEvent.click(screen.getByRole("button", { name: "Add to watchlist" }));

    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ tmdb_id: 603, title: "The Matrix" }),
    );
  });
});
