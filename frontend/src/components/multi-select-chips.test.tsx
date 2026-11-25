import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MultiSelectChips } from "@/components/multi-select-chips";

describe("MultiSelectChips", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders options with min-h-11 hit targets", () => {
    render(
      <MultiSelectChips
        options={["Horror", "Comedy"]}
        value={[]}
        onChange={() => {}}
      />,
    );

    const horror = screen.getByRole("button", { name: "Horror" });
    expect(horror.className).toMatch(/min-h-11/);
  });

  it("styles a selected chip as flat teal text on a surface fill", () => {
    render(
      <MultiSelectChips
        options={["Horror", "Comedy"]}
        value={["Horror"]}
        onChange={() => {}}
      />,
    );

    const selected = screen.getByRole("button", { name: "Horror" });
    expect(selected.className).toContain("rounded-cb");
    expect(selected.className).toContain("bg-cb-surface");
    expect(selected.className).toContain("border-cb-teal");
    expect(selected.className).toContain("text-cb-teal");
    expect(selected.className).not.toContain("shadow-glow");
    expect(selected.className).not.toMatch(/bg-cb-teal|bg-primary/);

    const idle = screen.getByRole("button", { name: "Comedy" });
    expect(idle.className).toContain("bg-cb-surface");
    expect(idle.className).not.toContain("border-cb-teal");
  });

  it("toggles selection on click", () => {
    const values: string[][] = [];
    const { rerender } = render(
      <MultiSelectChips
        options={["Horror"]}
        value={[]}
        onChange={(next) => values.push(next)}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Horror" }));
    expect(values[0]).toEqual(["Horror"]);

    rerender(
      <MultiSelectChips
        options={["Horror"]}
        value={["Horror"]}
        onChange={(next) => values.push(next)}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Horror" }));
    expect(values[1]).toEqual([]);
  });
});
