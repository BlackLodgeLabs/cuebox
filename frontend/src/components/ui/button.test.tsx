import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("merges consumer className with variant classes", () => {
    render(
      <Button className="w-full" data-testid="submit">
        Submit
      </Button>,
    );

    expect(screen.getByTestId("submit")).toHaveClass("w-full");
  });

  it("paints the primary action amber with ink text and an amber glow", () => {
    render(<Button>Where to watch</Button>);

    const button = screen.getByRole("button", { name: "Where to watch" });
    expect(button.className).toContain("bg-cb-accent");
    expect(button.className).toContain("text-cb-ink");
    expect(button.className).toContain("shadow-glow");
    expect(button.className).toContain("rounded-cb");
    expect(button.className).not.toContain("btn-chamfer");
  });

  it("paints the secondary action as a flat teal outline", () => {
    render(<Button variant="secondary">Get a pick for tonight</Button>);

    const button = screen.getByRole("button", { name: "Get a pick for tonight" });
    expect(button.className).toContain("border-cb-teal");
    expect(button.className).toContain("text-cb-teal");
    expect(button.className).not.toContain("shadow-glow");
    expect(button.className).not.toContain("bg-cb-teal");
  });

  it("paints the link action as flat teal text", () => {
    render(<Button variant="link">Surprise me</Button>);

    const button = screen.getByRole("button", { name: "Surprise me" });
    expect(button.className).toContain("text-cb-teal");
    expect(button.className).not.toContain("shadow-glow");
  });

  it("paints danger without a glow", () => {
    render(<Button variant="destructive">Delete</Button>);

    const button = screen.getByRole("button", { name: "Delete" });
    expect(button.className).toContain("bg-cb-danger");
    expect(button.className).not.toContain("shadow-glow");
  });
});
