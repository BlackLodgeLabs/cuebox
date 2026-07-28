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
