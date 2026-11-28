import { describe, expect, it } from "vitest";
import { tasteTickMotion, tickFills } from "@/lib/taste-ticks";

describe("taste ticks", () => {
  it("uses the locked fill: 70ms per tick, 330ms ease-out, no glow, 40% trigger, +90ms per row", () => {
    expect(tasteTickMotion(false)).toEqual({
      perTickMs: 70,
      fillMs: 330,
      rowDelayMs: 90,
      ease: [0.16, 1, 0.3, 1],
      glow: false,
      triggerRatio: 0.4,
      fadeTogether: false,
    });
  });

  it("fades the finished ticks together over 300ms when motion is reduced", () => {
    expect(tasteTickMotion(true)).toEqual({
      perTickMs: 0,
      fillMs: 300,
      rowDelayMs: 0,
      ease: "linear",
      glow: false,
      triggerRatio: 0,
      fadeTogether: true,
    });
  });

  it("fills whole ticks and a half tick for a 6.5 score", () => {
    expect(tickFills(6.5)).toEqual([1, 1, 1, 1, 1, 1, 0.5, 0, 0, 0]);
  });

  it("fills three ticks and a half for a 3.5 score", () => {
    expect(tickFills(3.5)).toEqual([1, 1, 1, 0.5, 0, 0, 0, 0, 0, 0]);
  });
});
