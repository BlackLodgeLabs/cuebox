import { afterEach, describe, expect, it } from "vitest";
import {
  batchMotion,
  confirmMotion,
  watchlistSwitchMotion,
  cueboxEase,
  numberMotion,
  pressMotion,
  readCssNumber,
  revealMotion,
  screenMotion,
  searchMotion,
  searchTransition,
  sheetCloseThreshold,
  sheetMotion,
  sheetTransition,
  toastMotion,
  toastTransition,
} from "@/lib/motion";

describe("locked app-wide motion", () => {
  it("uses the Cuebox ease-out and the §6.6 sheet, toast, and search transitions", () => {
    expect(cueboxEase).toEqual([0.16, 1, 0.3, 1]);
    expect(sheetTransition).toEqual({
      open: { duration: 0.8, ease: cueboxEase },
      close: { duration: 0.7, ease: cueboxEase },
    });
    expect(toastTransition).toEqual({
      enter: { duration: 0.7, ease: cueboxEase },
      exit: { duration: 0.6, ease: cueboxEase },
    });
    expect(searchTransition).toEqual({
      open: { duration: 0.7, ease: cueboxEase },
      close: { duration: 0.6, ease: cueboxEase },
    });
  });

  it("reads a duration token when the document sets one", () => {
    document.documentElement.style.setProperty("--cb-sheet-up", "810ms");
    expect(readCssNumber("--cb-sheet-up", 800)).toBe(810);
    expect(sheetMotion(false).openMs).toBe(810);
    expect(sheetMotion(false).open.duration).toBe(0.81);
  });

  it("falls back to the lock when a token is missing", () => {
    expect(sheetMotion(false)).toMatchObject({
      openMs: 800,
      closeMs: 700,
      dim: 0.55,
      dimFadeMs: 450,
      dismissPx: 120,
      travel: "y",
    });
    expect(toastMotion(false)).toMatchObject({
      enterMs: 700,
      exitMs: 600,
      travelPx: 20,
      stayMs: 2800,
      radiusPx: 12,
    });
    expect(searchMotion(false)).toMatchObject({
      openMs: 700,
      closeMs: 600,
      fromScale: 0.96,
      travel: "scale",
    });
    expect(confirmMotion(false)).toMatchObject({
      durationMs: 400,
      fromScale: 0.92,
      dim: 0.62,
      radiusPx: 16,
      travel: "scale",
    });
    expect(pressMotion(false)).toEqual({ scale: 0.96, downMs: 120, upMs: 200 });
    expect(screenMotion(false).fadeMs).toBe(400);
    expect(numberMotion(false)).toEqual({ durationMs: 400, settled: false });
    expect(revealMotion(false)).toMatchObject({ durationMs: 300, animateHeight: true });
    expect(batchMotion(false)).toEqual({ fadeMs: 300, staggerMs: 30 });
    expect(watchlistSwitchMotion(false)).toEqual({
      outMs: 400,
      inMs: 600,
      delayMs: 200,
      out: { duration: 0.4, ease: cueboxEase },
      in: { duration: 0.6, ease: cueboxEase, delay: 0.2 },
    });
  });

  it("treats a 120px drag as the dismiss threshold for the drawer's height", () => {
    expect(sheetCloseThreshold(600, 120)).toBeCloseTo(0.2);
    expect(sheetCloseThreshold(120, 120)).toBe(1);
    expect(sheetCloseThreshold(80, 120)).toBe(1);
    expect(sheetCloseThreshold(0, 120)).toBe(1);
  });

  it("drops travel and scale under reduced motion", () => {
    expect(sheetMotion(true)).toMatchObject({
      openMs: 300,
      closeMs: 300,
      travel: "none",
      dismissPx: 120,
    });
    expect(sheetMotion(true).open.ease).toBe("linear");

    expect(toastMotion(true)).toMatchObject({
      enterMs: 300,
      exitMs: 300,
      travelPx: 0,
      stayMs: 2800,
    });
    expect(searchMotion(true)).toMatchObject({
      openMs: 300,
      closeMs: 300,
      fromScale: 1,
      travel: "none",
    });
    expect(confirmMotion(true)).toMatchObject({
      durationMs: 300,
      fromScale: 1,
      dim: 0.62,
      travel: "none",
    });
    expect(pressMotion(true)).toEqual({ scale: 1, downMs: 0, upMs: 0 });
    expect(screenMotion(true).fadeMs).toBe(300);
    expect(numberMotion(true)).toEqual({ durationMs: 0, settled: true });
    expect(revealMotion(true)).toMatchObject({
      durationMs: 300,
      animateHeight: false,
    });
    expect(batchMotion(true)).toEqual({ fadeMs: 300, staggerMs: 0 });
    expect(watchlistSwitchMotion(true)).toEqual({
      outMs: 300,
      inMs: 300,
      delayMs: 0,
      out: { duration: 0.3, ease: "linear" },
      in: { duration: 0.3, ease: "linear" },
    });
  });
});

afterEach(() => {
  document.documentElement.style.removeProperty("--cb-sheet-up");
});
