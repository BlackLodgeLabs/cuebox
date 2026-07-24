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

  it("exposes Search films header link to /search", () => {
    render(
      <AppShell>
        <div>content</div>
      </AppShell>,
    );

    const searchLink = screen.getByRole("link", { name: "Search films" });
    expect(searchLink).toHaveAttribute("href", "/search");
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
