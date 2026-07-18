import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HalfStarRatingInput } from "@/components/half-star-rating-input";

describe("HalfStarRatingInput", () => {
  afterEach(() => {
    cleanup();
  });

  it("selects half-star steps", () => {
    const onChange = vi.fn();
    render(<HalfStarRatingInput value={null} onChange={onChange} />);

    fireEvent.click(screen.getByRole("radio", { name: "3.5 stars" }));
    expect(onChange).toHaveBeenCalledWith(3.5);
  });
});
