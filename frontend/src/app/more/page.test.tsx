import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import MorePage from "@/app/more/page";

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

describe("MorePage", () => {
  afterEach(() => {
    cleanup();
  });

  it("lists Sync, Import, and History destinations in locked order", () => {
    render(<MorePage />);

    expect(screen.getByRole("heading", { name: "More" })).toBeInTheDocument();

    const nav = screen.getByRole("navigation", { name: "More destinations" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/settings/sync",
      "/import",
      "/history",
    ]);
    expect(within(nav).getByRole("link", { name: /sync/i })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: /import/i })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: /history/i })).toBeInTheDocument();
  });
});
