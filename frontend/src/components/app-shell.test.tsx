import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/app-shell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/review",
}));

vi.mock("@/hooks/use-films", () => ({
  usePendingReviewCount: () => ({ data: 3 }),
}));

describe("AppShell", () => {
  afterEach(() => {
    cleanup();
  });

  it("keeps the Home nav link on / even when reviews are pending", () => {
    render(
      <AppShell>
        <div>content</div>
      </AppShell>,
    );

    const homeLink = screen.getByRole("link", { name: /home/i });
    expect(homeLink).toHaveAttribute("href", "/");
  });

  it("exposes Search films header link to /search after main nav and before Review", () => {
    render(
      <AppShell>
        <div>content</div>
      </AppShell>,
    );

    const searchLink = screen.getByRole("link", { name: "Search films" });
    expect(searchLink).toHaveAttribute("href", "/search");

    const navLinks = screen.getAllByRole("link").filter((link) => {
      const href = link.getAttribute("href");
      return (
        href === "/" ||
        href === "/watchlist" ||
        href === "/recommend" ||
        href === "/history" ||
        href === "/settings/sync" ||
        href === "/search" ||
        href === "/review"
      );
    });
    const hrefs = navLinks.map((link) => link.getAttribute("href"));
    expect(hrefs.indexOf("/search")).toBeGreaterThan(hrefs.indexOf("/settings/sync"));
    expect(hrefs.indexOf("/search")).toBeLessThan(hrefs.indexOf("/review"));
  });

  it("applies text-foreground to active Review nav link", () => {
    render(
      <AppShell>
        <div>content</div>
      </AppShell>,
    );

    const reviewLink = screen.getByRole("link", { name: "Review 3" });
    expect(reviewLink.className).toContain("text-foreground");
    expect(reviewLink.className).toContain("bg-accent");
  });
});
