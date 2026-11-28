import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/app-shell";
import { createQueryWrapper } from "@/test/query-wrapper";

const navigationState = vi.hoisted(() => ({
  pathname: "/",
  search: "",
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationState.pathname,
  useSearchParams: () => new URLSearchParams(navigationState.search),
  useRouter: () => ({
    replace: navigationState.replace,
    push: vi.fn(),
    back: vi.fn(),
  }),
}));

function renderShell() {
  const { Wrapper } = createQueryWrapper();
  return render(
    <Wrapper>
      <AppShell>
        <div>content</div>
      </AppShell>
    </Wrapper>,
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
    navigationState.search = "";
    navigationState.replace.mockReset();
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

  it("previews tonight's programme with Recommend selected and no header", () => {
    navigationState.pathname = "/dev/programme";
    renderShell();

    expect(screen.queryByRole("textbox", { name: "Search films" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Cuebox" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Recommend" })).toHaveAttribute("aria-current", "page");
  });

  it("previews a past night under the wordmark with More selected", () => {
    navigationState.pathname = "/dev/programme/history";
    renderShell();

    expect(screen.getByRole("link", { name: "Cuebox" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Search films" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "More" })).toHaveAttribute("aria-current", "page");
  });

  it("hides the header and tab bar on the questionnaire", () => {
    navigationState.pathname = "/recommend";
    renderShell();

    expect(screen.queryByRole("navigation", { name: "Primary" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Search films" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Cuebox" })).not.toBeInTheDocument();
  });

  it("shows a fresh programme under Recommend without the search header", () => {
    navigationState.pathname = "/recommend/results/session-1";
    renderShell();

    expect(screen.queryByRole("textbox", { name: "Search films" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Recommend" })).toHaveAttribute("aria-current", "page");
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
    { pathname: "/recommend/abc", active: "Recommend" },
    { pathname: "/recommend/results/session-1", active: "Recommend" },
    { pathname: "/more", active: "More" },
    { pathname: "/settings/sync", active: "More" },
  ] as const)(
    "marks $active active on $pathname",
    ({ pathname, active }) => {
      navigationState.pathname = pathname;
      renderShell();

      const activeLink = screen.getByRole("link", { name: active });
      expect(activeLink).toHaveAttribute("aria-current", "page");
      expect(activeLink.className).toContain("text-cb-teal");
      expect(activeLink.className).toContain("text-cb-tab");
      expect(activeLink.className).not.toMatch(/shadow/);
      expect(activeLink.querySelector("[data-active-indicator]")).toBeNull();

      for (const label of ["Home", "Watchlist", "Recommend", "More"] as const) {
        if (label === active) continue;
        const inactive = screen.getByRole("link", { name: label });
        expect(inactive).not.toHaveAttribute("aria-current");
        expect(inactive.className).toContain("text-cb-muted");
        expect(inactive.className).not.toMatch(/shadow/);
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

  it("shows a visual Search films field and the wordmark in a 52px header", () => {
    renderShell();

    const header = document.querySelector("header");
    expect(header).not.toBeNull();
    expect(header!.className).toMatch(/safe-area-inset-top/);

    const row = document.querySelector("[data-shell-header]");
    expect(row).not.toBeNull();
    expect(row!.className).toContain("h-[52px]");

    expect(screen.getByRole("link", { name: "Cuebox" })).toBeInTheDocument();
    expect(screen.getByText("Cue")).toHaveClass("text-cb-accent");
    expect(screen.getByText("box.")).toHaveClass("text-cb-teal");

    const search = screen.getByRole("textbox", { name: "Search films" });
    expect(search).toHaveAttribute("placeholder", "Search films");
    expect(search).toHaveProperty("readOnly", true);
    expect(screen.queryByRole("link", { name: "Search films" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /review/i })).not.toBeInTheDocument();
  });

  it("uses a 90px flat tab bar", () => {
    renderShell();

    const tabBar = document.querySelector("[data-shell-tabbar]");
    expect(tabBar).not.toBeNull();
    expect(tabBar!.className).toContain("h-[90px]");
    expect(tabBar!.className).not.toMatch(/shadow/);
  });

  it("keeps the Home tab href on /", () => {
    navigationState.pathname = "/review";
    renderShell();

    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("applies min 44px hit-target classes on tabs", () => {
    renderShell();

    for (const label of ["Home", "Watchlist", "Recommend", "More"]) {
      const tab = screen.getByRole("link", { name: label });
      expect(tab.className).toContain("min-h-[44px]");
      expect(tab.className).toContain("min-w-[44px]");
    }
  });

  it("opens the search card from the header on the watchlist", async () => {
    navigationState.pathname = "/watchlist";
    renderShell();

    expect(screen.queryByRole("dialog", { name: "Search films" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("textbox", { name: "Search films" }));
    expect(screen.getByRole("dialog", { name: "Search films" })).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveAttribute("data-open-ms", "700");
    expect(screen.getByRole("dialog")).toHaveAttribute("data-from-scale", "0.96");
  });

  it("opens the search card from ?focus=search and clears the param", async () => {
    navigationState.search = "focus=search";
    renderShell();

    expect(await screen.findByRole("dialog", { name: "Search films" })).toBeInTheDocument();
    expect(navigationState.replace).toHaveBeenCalledWith("/", { scroll: false });
  });

  it("hides the shell chrome on the catalogue film page", () => {
    navigationState.pathname = "/films/tmdb/603";
    renderShell();

    expect(screen.queryByRole("textbox", { name: "Search films" })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Primary" })).not.toBeInTheDocument();
    expect(screen.getByText("content")).toBeInTheDocument();
  });

  it("hides the header and tab bar on a film detail screen", () => {
    navigationState.pathname = "/watchlist/film-1";
    renderShell();

    expect(screen.queryByRole("navigation", { name: "Primary" })).not.toBeInTheDocument();
    expect(document.querySelector("header")).toBeNull();
    expect(screen.queryByRole("textbox", { name: "Search films" })).not.toBeInTheDocument();
    expect(document.querySelector("main")?.className).toContain("px-0");
  });

  it("keeps the shell on the watchlist and the add-film route", () => {
    for (const pathname of ["/watchlist", "/watchlist/add"]) {
      navigationState.pathname = pathname;
      const { unmount } = renderShell();
      expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
      expect(document.querySelector("header")).not.toBeNull();
      unmount();
    }
  });

  it("does not render a FAB control", () => {
    renderShell();

    expect(screen.queryByRole("button", { name: /fab|floating/i })).toBeNull();
    expect(document.querySelector("[data-fab]")).toBeNull();
  });
});
