import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import MorePage from "@/app/more/page";
import { createQueryWrapper } from "@/test/query-wrapper";

const pendingCount = vi.hoisted(() => ({
  value: { metadata_count: 0, watch_review_count: 0, total: 0 },
}));

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

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return {
    ...actual,
    getPendingReviewCount: () => Promise.resolve(pendingCount.value),
  };
});

function renderMorePage() {
  const { Wrapper } = createQueryWrapper();
  return render(
    <Wrapper>
      <MorePage />
    </Wrapper>,
  );
}

function reviewsLink() {
  const nav = screen.getByRole("navigation", { name: "More destinations" });
  return within(nav).getByRole("link", { name: /reviews/i });
}

describe("MorePage", () => {
  afterEach(() => {
    cleanup();
    pendingCount.value = { metadata_count: 0, watch_review_count: 0, total: 0 };
  });

  it("lists History, My services, Sync, Import, and Reviews", async () => {
    renderMorePage();

    expect(screen.getByRole("heading", { name: "More" })).toBeInTheDocument();

    const nav = screen.getByRole("navigation", { name: "More destinations" });
    await waitFor(() => {
      expect(within(nav).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
        "/history",
        "/settings/services",
        "/settings/sync",
        "/import",
        "/review",
      ]);
    });

    expect(within(nav).getByRole("link", { name: /history/i })).toHaveAttribute("href", "/history");
    expect(within(nav).getByRole("link", { name: /my services/i })).toHaveAttribute(
      "href",
      "/settings/services",
    );
    expect(within(nav).getByRole("link", { name: /sync/i })).toHaveAttribute("href", "/settings/sync");
    expect(within(nav).getByRole("link", { name: /import/i })).toHaveAttribute("href", "/import");
    expect(reviewsLink()).toHaveAttribute("href", "/review");
    expect(reviewsLink().textContent ?? "").not.toMatch(/\d/);
  });

  it("shows the pending review count only when films are waiting", async () => {
    pendingCount.value = { metadata_count: 2, watch_review_count: 1, total: 3 };
    renderMorePage();

    await waitFor(() => {
      expect(reviewsLink().textContent).toContain("3");
    });
  });
});
