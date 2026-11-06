import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ImportStatusPage from "@/app/import/[jobId]/page";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ jobId: "job-12345678-abcd" }),
}));

vi.mock("@/hooks/use-import", () => ({
  useImportStatus: () => ({
    data: {
      job_id: "job-12345678-abcd",
      status: "complete",
      processed_films: 10,
      failed_films: 1,
      duplicate_films: 0,
      total_films: 11,
      failure_summary: [
        {
          letterboxd_uri:
            "https://letterboxd.com/film/a-very-long-film-slug-that-should-wrap/",
          reason: "TMDB match failed",
        },
      ],
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-films", () => ({
  useReviewRequired: () => ({
    data: { data: [], pagination: { total: 0, limit: 1, offset: 0, has_more: false } },
    isLoading: false,
  }),
}));

describe("ImportStatusPage", () => {
  afterEach(() => {
    cleanup();
  });

  it("wraps failure URIs and uses ≥44px complete CTAs", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    render(<ImportStatusPage />);

    expect(screen.getByRole("link", { name: /← home/i })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: /← home/i }).className).toMatch(
      /min-h-11/,
    );

    const failureToggle = screen.getByRole("button", {
      name: /show failure details/i,
    });
    expect(failureToggle.className).toMatch(/min-h-11/);
    await user.click(failureToggle);

    const uri = screen.getByText(
      /https:\/\/letterboxd\.com\/film\/a-very-long-film-slug-that-should-wrap\//i,
    );
    expect(uri.className).toMatch(/break-all/);

    const recommend = screen.getByRole("link", { name: /get a recommendation/i });
    expect(recommend.className).toMatch(/min-h-11/);
  });
});
