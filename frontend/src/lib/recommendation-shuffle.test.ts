import { describe, expect, it } from "vitest";
import {
  SHUFFLE_MOTION,
  buildShuffleReel,
  chooseLandingOffsetPx,
  highlightOpacityAt,
  initialShuffleState,
  shuffleCruiseOffsetPx,
  shuffleSlowDistancePx,
  shuffleEaseOut,
  shuffleSlowEase,
  stepShuffle,
  type ShuffleFrame,
} from "@/lib/recommendation-shuffle";

const VIEWPORT = 390;

function winnerFrames(): ShuffleFrame[] {
  return Array.from({ length: 16 }, (_, index) => ({
    filmId: index % 3 === 0 ? "winner" : `film-${index}`,
    backdropUrl: index % 3 === 0 ? "winner.jpg" : `film-${index}.jpg`,
  }));
}

describe("recommendation shuffle", () => {
  it("locks the cruise, wind-down, highlight, expand, and reduced-motion values", () => {
    expect(SHUFFLE_MOTION).toEqual({
      cruisePxPerSec: 420,
      minCruiseMs: 2000,
      slowMs: 2500,
      slowPower: 1.38,
      highlightRiseMs: 80,
      highlightHoldMs: 120,
      highlightFadeMs: 400,
      highlightOpacity: 0.95,
      highlightShadow: "0 0 18px rgba(224,122,40,0.45)",
      expandMs: 580,
      reducedCrossfadeMs: 300,
    });
    expect(shuffleSlowDistancePx()).toBeCloseTo(760.87, 2);
    expect(shuffleSlowEase(0)).toBe(0);
    expect(shuffleSlowEase(1)).toBe(1);
    expect(shuffleSlowEase(0.5)).toBeCloseTo(0.615781, 5);
    expect(shuffleEaseOut(0)).toBe(0);
    expect(shuffleEaseOut(1)).toBe(1);
    expect(shuffleEaseOut(0.5)).toBeCloseTo(0.875, 5);
    expect(shuffleCruiseOffsetPx(1000)).toBe(420);
    expect(highlightOpacityAt(0)).toBe(0);
    expect(highlightOpacityAt(40)).toBeCloseTo(0.475, 5);
    expect(highlightOpacityAt(80)).toBeCloseTo(0.95, 5);
    expect(highlightOpacityAt(200)).toBeCloseTo(0.95, 5);
    expect(highlightOpacityAt(400)).toBeCloseTo(0.475, 5);
    expect(highlightOpacityAt(600)).toBe(0);
  });

  it("puts the winning still in the reel when the watchlist did not include it", () => {
    expect(
      buildShuffleReel(
        [{ filmId: "a", backdropUrl: "a.jpg" }],
        { filmId: "winner", backdropUrl: "w.jpg" },
      ),
    ).toEqual([
      { filmId: "a", backdropUrl: "a.jpg" },
      { filmId: "winner", backdropUrl: "w.jpg" },
    ]);

    expect(
      buildShuffleReel(
        [{ filmId: "winner", backdropUrl: "w.jpg" }],
        { filmId: "winner", backdropUrl: "w.jpg" },
      ),
    ).toEqual([{ filmId: "winner", backdropUrl: "w.jpg" }]);

    expect(buildShuffleReel([], { filmId: "winner", backdropUrl: null })).toEqual([
      { filmId: "winner", backdropUrl: null },
    ]);
  });

  it("keeps cruising until the response has arrived and 2000ms have played", () => {
    const frames = winnerFrames();
    const early = stepShuffle(initialShuffleState(), {
      elapsedMs: 1999,
      responseReady: true,
      frames,
      winnerFilmId: "winner",
      viewportWidthPx: VIEWPORT,
    });
    expect(early.phase).toBe("cruise");
    expect(early.offsetPx).toBeCloseTo(839.58, 1);

    const waiting = stepShuffle(initialShuffleState(), {
      elapsedMs: 5000,
      responseReady: false,
      frames,
      winnerFilmId: "winner",
      viewportWidthPx: VIEWPORT,
    });
    expect(waiting.phase).toBe("cruise");
    expect(waiting.offsetPx).toBe(2100);
    expect(waiting.landingIndex).toBeNull();
  });

  it("lands on the next winner copy after travelling exactly one wind-down", () => {
    const frames = winnerFrames();
    const planned = stepShuffle(initialShuffleState(), {
      elapsedMs: 2000,
      responseReady: true,
      frames,
      winnerFilmId: "winner",
      viewportWidthPx: VIEWPORT,
    });
    // The copy at index 9 is further than one wind-down, so the cruise
    // continues until that still is exactly 760.87px ahead.
    expect(planned.phase).toBe("cruise");
    expect(planned.offsetPx).toBe(840);
    expect(planned.state.landingIndex).toBe(9);
    expect(frames[planned.state.landingIndex!].filmId).toBe("winner");
    expect(planned.state.landingOffsetPx).toBe(1838);
    expect(planned.state.windDownStartMs).toBeCloseTo(2564.596, 2);
    expect(planned.state.landingOffsetPx! - shuffleCruiseOffsetPx(planned.state.windDownStartMs!)).toBeCloseTo(
      760.87,
      2,
    );

    const mid = stepShuffle(planned.state, {
      elapsedMs: 3814.596,
      responseReady: true,
      frames,
      winnerFilmId: "winner",
      viewportWidthPx: VIEWPORT,
    });
    expect(mid.phase).toBe("slow");
    expect(mid.offsetPx).toBeCloseTo(1545.659, 2);

    const highlighted = stepShuffle(planned.state, {
      elapsedMs: 5144.596,
      responseReady: true,
      frames,
      winnerFilmId: "winner",
      viewportWidthPx: VIEWPORT,
    });
    expect(highlighted.phase).toBe("highlight");
    expect(highlighted.offsetPx).toBe(1838);
    expect(highlighted.highlightOpacity).toBeCloseTo(0.95, 5);

    const windDownStart = planned.state.windDownStartMs ?? 0;
    const expanding = stepShuffle(planned.state, {
      elapsedMs: windDownStart + 2500 + 600 + 1,
      responseReady: true,
      frames,
      winnerFilmId: "winner",
      viewportWidthPx: VIEWPORT,
    });
    expect(expanding.phase).toBe("expand");
    expect(expanding.expandProgress).toBeCloseTo(1 / 580, 4);

    const settled = stepShuffle(planned.state, {
      elapsedMs: windDownStart + 2500 + 600 + 580,
      responseReady: true,
      frames,
      winnerFilmId: "winner",
      viewportWidthPx: VIEWPORT,
    });
    expect(settled.phase).toBe("settled");
    expect(settled.landingIndex).toBe(9);
  });

  it("still lands on the winner when the reel is a single repeating still", () => {
    const frames = [{ filmId: "winner", backdropUrl: "w.jpg" }];
    const landing = chooseLandingOffsetPx({
      cruiseOffsetPx: 840,
      viewportWidthPx: VIEWPORT,
      frames,
      winnerFilmId: "winner",
    });
    expect(landing.index).toBe(8);
    expect(frames[landing.index % frames.length].filmId).toBe("winner");
    expect(landing.offsetPx).toBe(1624);
    expect(landing.offsetPx - 840).toBeCloseTo(784, 0);
    const startOffset = landing.offsetPx - shuffleSlowDistancePx();
    expect(landing.offsetPx - startOffset).toBeCloseTo(760.87, 2);
  });
});
