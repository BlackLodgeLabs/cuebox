import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OffTabPageHeader } from "@/components/off-tab-page-header";

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

describe("OffTabPageHeader", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders ← Home to / with ≥44px hit target and title", () => {
    render(<OffTabPageHeader title="History" subtitle="Past picks" />);

    const home = screen.getByRole("link", { name: /← home/i });
    expect(home).toHaveAttribute("href", "/");
    expect(home.className).toMatch(/min-h-11/);
    expect(screen.getByRole("heading", { name: "History" })).toBeInTheDocument();
    expect(screen.getByText("Past picks")).toBeInTheDocument();
  });
});
