import { describe, expect, it } from "vitest";
import {
  HOME_ARRIVAL,
  irisProgress,
  splashWordmarkOpacity,
} from "@/lib/home-arrival";

describe("home arrival timings", () => {
  it("matches the option-E table in the design pack", () => {
    expect(HOME_ARRIVAL).toEqual({
      logoScale: 0.85,
      logoWallMs: 2035,
      wordmarkLockMs: 1894,
      beatMs: 80,
      irisStartMs: 1974,
      irisDurationMs: 760,
      irisEase: [0.42, 0, 0.58, 1],
      softEdgeFromPx: 1.25,
      softEdgeToPx: 12,
      wordmarkFadeDelayMs: 80,
      wordmarkFadeMs: 600,
      chromeStartMs: 2674,
      restStartMs: 2734,
      restRisePx: 6,
      restStaggerMs: 70,
      restDurationMs: 300,
    });
  });

  it("opens the iris with smoothstep and fades the splash wordmark after it starts", () => {
    expect(irisProgress(1974)).toBe(0);
    expect(irisProgress(1974 + 380)).toBeCloseTo(0.5, 5);
    expect(irisProgress(1974 + 760)).toBe(1);
    expect(splashWordmarkOpacity(2054)).toBe(1);
    expect(splashWordmarkOpacity(2054 + 300)).toBeCloseTo(0.5, 5);
    expect(splashWordmarkOpacity(2654)).toBe(0);
  });
});
