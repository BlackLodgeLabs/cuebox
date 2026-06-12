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
});
