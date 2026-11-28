import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SectionHeader } from "@/components/section-header";

describe("SectionHeader", () => {
  it("renders a Big Shoulders heading with a short teal hairline and no index", () => {
    render(<SectionHeader title="Folk dread" />);

    const heading = screen.getByRole("heading", { name: "Folk dread" });
    expect(heading.className).toContain("font-display");
    expect(heading.className).toContain("text-cb-card");
    expect(heading.textContent).toBe("Folk dread");

    const hairline = document.querySelector("[data-section-hairline]");
    expect(hairline).not.toBeNull();
    expect(hairline).toHaveClass("bg-cb-teal");
    expect(hairline?.className ?? "").not.toMatch(/shadow|glow/);
    expect(screen.queryByText(/^0\d/)).not.toBeInTheDocument();
  });
});
