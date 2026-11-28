import { describe, expect, it } from "vitest";
import { surpriseOffset } from "@/lib/surprise-pick";

describe("surpriseOffset", () => {
  it("picks another watchlist slot and skips the film already on screen", () => {
    expect(surpriseOffset(4, 1, () => 0)).toBe(0);
    expect(surpriseOffset(4, 1, () => 0.99)).toBe(3);
    expect(surpriseOffset(1, 0, () => 0.4)).toBe(0);
    expect(surpriseOffset(0, 0, () => 0.4)).toBe(0);
  });
});
