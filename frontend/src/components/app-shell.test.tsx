import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/app-shell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/review",
}));

vi.mock("@/hooks/use-films", () => ({
  usePendingReviewCount: () => ({ data: 3 }),
}));

describe("AppShell", () => {
  it("keeps the Home nav link on / even when reviews are pending", () => {
    render(
      <AppShell>
        <div>content</div>
      </AppShell>,
    );

    const homeLink = screen.getByRole("link", { name: /home/i });
    expect(homeLink).toHaveAttribute("href", "/");
  });
});
