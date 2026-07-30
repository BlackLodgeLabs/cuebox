import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/app-shell";

const navigationState = vi.hoisted(() => ({
  pathname: "/",
}));

const pendingReviewState = vi.hoisted(() => ({
  count: 0,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationState.pathname,
}));

vi.mock("@/hooks/use-films", () => ({
  usePendingReviewCount: () => ({ data: pendingReviewState.count }),
}));

function renderShell() {
  return render(
    <AppShell>
      <div>content</div>
    </AppShell>,
  );
}

function primaryNav() {
  return screen.getByRole("navigation", { name: "Primary" });
}

function bottomTabLinks() {
  return within(primaryNav()).getAllByRole("link");
}

describe("AppShell", () => {
  beforeEach(() => {
    navigationState.pathname = "/";
    pendingReviewState.count = 0;
  });

  afterEach(() => {
    cleanup();
  });

  it("renders exactly four bottom tabs without History or Settings peers", () => {
    renderShell();

    const tabs = bottomTabLinks();
    expect(tabs).toHaveLength(4);
    expect(tabs.map((tab) => tab.getAttribute("href"))).toEqual([
      "/",
      "/watchlist",
      "/recommend",
      "/more",
    ]);
    for (const label of ["Home", "Watchlist", "Recommend", "More"]) {
      expect(
        within(primaryNav()).getByRole("link", { name: label }),
      ).toBeInTheDocument();
    }
    expect(
      within(primaryNav()).queryByRole("link", { name: /history/i }),
    ).not.toBeInTheDocument();
    expect(
      within(primaryNav()).queryByRole("link", { name: /^settings$/i }),
    ).not.toBeInTheDocument();
  });

  it("routes More to /more", () => {
    renderShell();

    expect(screen.getByRole("link", { name: "More" })).toHaveAttribute(
      "href",
      "/more",
    );
  });

  it.each([
    { pathname: "/", active: "Home" },
    { pathname: "/watchlist", active: "Watchlist" },
    { pathname: "/watchlist/add", active: "Watchlist" },
    { pathname: "/recommend", active: "Recommend" },
    { pathname: "/recommend/abc", active: "Recommend" },
    { pathname: "/more", active: "More" },
    { pathname: "/settings/sync", active: "More" },
  ] as const)(
    "marks $active active on $pathname",
    ({ pathname, active }) => {
      navigationState.pathname = pathname;
      renderShell();

      const activeLink = screen.getByRole("link", { name: active });
      expect(activeLink).toHaveAttribute("aria-current", "page");
      expect(activeLink.className).toContain("text-primary");
      expect(
        activeLink.querySelector("[data-active-indicator]"),
      ).not.toBeNull();
      expect(activeLink.className).toMatch(/font-bold|font-semibold/);

      for (const label of ["Home", "Watchlist", "Recommend", "More"] as const) {
        if (label === active) continue;
        const inactive = screen.getByRole("link", { name: label });
        expect(inactive).not.toHaveAttribute("aria-current");
        expect(inactive.className).toContain("text-muted-foreground");
        expect(inactive.querySelector("[data-active-indicator]")).toBeNull();
      }
    },
  );

  it("does not force More active on /import or /history", () => {
    for (const pathname of ["/import", "/history"] as const) {
      navigationState.pathname = pathname;
      const { unmount } = renderShell();

      for (const label of ["Home", "Watchlist", "Recommend", "More"]) {
        expect(screen.getByRole("link", { name: label })).not.toHaveAttribute(
          "aria-current",
        );
      }
      unmount();
    }
  });

  it("pads sticky header with top safe-area inset", () => {
    renderShell();

    const header = document.querySelector("header");
    expect(header).not.toBeNull();
    expect(header!.className).toMatch(/safe-area-inset-top/);
  });

  it("exposes Search films header link to /search", () => {
    renderShell();

    const searchLink = screen.getByRole("link", { name: "Search films" });
    expect(searchLink).toHaveAttribute("href", "/search");
  });

  it("shows Review badge when pending count > 0", () => {
    pendingReviewState.count = 3;
    navigationState.pathname = "/review";
    renderShell();

    const reviewLink = screen.getByRole("link", { name: "Review 3" });
    expect(reviewLink).toHaveAttribute("href", "/review");
    expect(reviewLink.className).toContain("text-foreground");
    expect(reviewLink.className).toContain("bg-accent");
  });

  it("hides Review when pending count is 0", () => {
    pendingReviewState.count = 0;
    renderShell();

    expect(
      screen.queryByRole("link", { name: /review/i }),
    ).not.toBeInTheDocument();
  });

  it("keeps Home tab href on / even when reviews are pending", () => {
    pendingReviewState.count = 2;
    navigationState.pathname = "/review";
    renderShell();

    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("applies min 44px hit-target classes on tabs and header controls", () => {
    pendingReviewState.count = 1;
    renderShell();

    for (const label of ["Home", "Watchlist", "Recommend", "More"]) {
      const tab = screen.getByRole("link", { name: label });
      expect(tab.className).toContain("min-h-[44px]");
      expect(tab.className).toContain("min-w-[44px]");
    }

    expect(screen.getByRole("link", { name: "Search films" }).className).toContain(
      "min-h-[44px]",
    );
    expect(screen.getByRole("link", { name: "Review 1" }).className).toContain(
      "min-h-[44px]",
    );
  });

  it("does not render a FAB control", () => {
    renderShell();

    expect(screen.queryByRole("button", { name: /fab|floating/i })).toBeNull();
    expect(document.querySelector("[data-fab]")).toBeNull();
  });
});
