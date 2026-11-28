import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Wordmark } from "@/components/wordmark";

describe("Wordmark", () => {
  it("renders Cuebox. with amber Cue and teal box.", () => {
    render(<Wordmark />);

    const cue = screen.getByText("Cue");
    const box = screen.getByText("box.");
    expect(cue).toHaveClass("text-cb-accent");
    expect(box).toHaveClass("text-cb-teal");
    expect(cue.parentElement).toHaveTextContent("Cuebox.");

    const link = screen.getByRole("link", { name: "Cuebox" });
    expect(link).toHaveAttribute("href", "/");
    expect(link.className).toContain("font-display");
    expect(link.className).toContain("cb-opsz-72");
    expect(link.className).toContain("text-cb-section");
  });
});
