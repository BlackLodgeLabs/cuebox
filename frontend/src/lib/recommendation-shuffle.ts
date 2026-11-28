/**
 * Film-strip shuffle from the Nov 2026 pack (README §6.2).
 * Cruise is a constant 420px/s. Wind-down uses 1-(1-u)^1.38 over 2.5s
 * so the opening speed matches the cruise. The winner is the next copy
 * at least one wind-down ahead; the cruise holds until that copy is
 * exactly one wind-down ahead, then the ease travels that distance.
 */

export const SHUFFLE_MOTION = {
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
} as const;

/** Cell width in the locked tester. The still is centred in the cell. */
export const SHUFFLE_FRAME_STRIDE_PX = 214;
export const SHUFFLE_FRAME_CENTER_PX = 107;

export type ShuffleFrame = {
  filmId: string;
  backdropUrl: string | null;
};

export type ShufflePhase = "cruise" | "slow" | "highlight" | "expand" | "settled";

export type ShuffleState = {
  windDownStartMs: number | null;
  landingOffsetPx: number | null;
  landingIndex: number | null;
};

export function initialShuffleState(): ShuffleState {
  return { windDownStartMs: null, landingOffsetPx: null, landingIndex: null };
}

export function shuffleSlowEase(progress: number): number {
  const u = Math.min(1, Math.max(0, progress));
  return 1 - (1 - u) ** SHUFFLE_MOTION.slowPower;
}

export function shuffleSlowDistancePx(): number {
  return (
    (SHUFFLE_MOTION.cruisePxPerSec * (SHUFFLE_MOTION.slowMs / 1000)) /
    SHUFFLE_MOTION.slowPower
  );
}

export function shuffleCruiseOffsetPx(elapsedMs: number): number {
  return SHUFFLE_MOTION.cruisePxPerSec * (Math.max(0, elapsedMs) / 1000);
}

export function highlightOpacityAt(msAfterLand: number): number {
  const rise = SHUFFLE_MOTION.highlightRiseMs;
  const hold = SHUFFLE_MOTION.highlightHoldMs;
  const fade = SHUFFLE_MOTION.highlightFadeMs;
  const peak = SHUFFLE_MOTION.highlightOpacity;
  if (msAfterLand <= 0) return 0;
  if (msAfterLand < rise) return peak * (msAfterLand / rise);
  if (msAfterLand < rise + hold) return peak;
  if (msAfterLand < rise + hold + fade) {
    const u = (msAfterLand - rise - hold) / fade;
    return peak * (1 - u);
  }
  return 0;
}

/** Watchlist stills, with the winner appended when it was not already there. */
export function buildShuffleReel(
  watchlist: ShuffleFrame[],
  winner: ShuffleFrame,
): ShuffleFrame[] {
  const frames: ShuffleFrame[] = [];
  const seen = new Set<string>();
  for (const frame of watchlist) {
    if (!frame.filmId || seen.has(frame.filmId)) continue;
    seen.add(frame.filmId);
    frames.push({ filmId: frame.filmId, backdropUrl: frame.backdropUrl });
  }
  if (winner.filmId && !seen.has(winner.filmId)) {
    frames.push({ filmId: winner.filmId, backdropUrl: winner.backdropUrl });
  }
  if (frames.length === 0) {
    frames.push({
      filmId: winner.filmId || "unknown",
      backdropUrl: winner.backdropUrl ?? null,
    });
  }
  return frames;
}

/** Shared ease-out. Power 3 is the tester's cubic; the wind-down uses 1.38. */
export function shuffleEaseOut(progress: number, power = 3): number {
  const u = Math.min(1, Math.max(0, progress));
  return 1 - (1 - u) ** power;
}

/** Notes leave / strip fade-in from the locked tester (260ms). */
export const SHUFFLE_NOTES_LEAVE_MS = 260;

/**
 * Next copy of the winner at least one wind-down ahead.
 * The slow-down itself always travels exactly `shuffleSlowDistancePx()`,
 * so its opening speed matches the 420px/s cruise. Cruise continues until
 * that copy is exactly one wind-down ahead.
 */
export function chooseLandingOffsetPx(input: {
  cruiseOffsetPx: number;
  viewportWidthPx: number;
  frames: ShuffleFrame[];
  winnerFilmId: string;
}): { offsetPx: number; index: number } {
  const slow = shuffleSlowDistancePx();
  const count = Math.max(1, input.frames.length);
  const reach = input.cruiseOffsetPx + slow + input.viewportWidthPx;
  const maxIndex = count * 8 + Math.ceil(reach / SHUFFLE_FRAME_STRIDE_PX) + count;
  for (let index = 0; index < maxIndex; index += 1) {
    const frame = input.frames[index % count];
    if (!frame || frame.filmId !== input.winnerFilmId) continue;
    const offsetPx =
      index * SHUFFLE_FRAME_STRIDE_PX +
      SHUFFLE_FRAME_CENTER_PX -
      input.viewportWidthPx / 2;
    if (offsetPx + 0.5 < input.cruiseOffsetPx + slow) continue;
    return { offsetPx, index };
  }
  return {
    offsetPx: input.cruiseOffsetPx + slow,
    index: 0,
  };
}

export function stepShuffle(
  prev: ShuffleState,
  input: {
    elapsedMs: number;
    responseReady: boolean;
    frames: ShuffleFrame[];
    winnerFilmId: string;
    viewportWidthPx: number;
  },
): {
  state: ShuffleState;
  phase: ShufflePhase;
  offsetPx: number;
  highlightOpacity: number;
  expandProgress: number;
  landingIndex: number | null;
} {
  let state = prev;
  if (
    state.windDownStartMs == null &&
    input.responseReady &&
    input.elapsedMs >= SHUFFLE_MOTION.minCruiseMs &&
    input.winnerFilmId
  ) {
    const cruiseNow = shuffleCruiseOffsetPx(input.elapsedMs);
    const landing = chooseLandingOffsetPx({
      cruiseOffsetPx: cruiseNow,
      viewportWidthPx: input.viewportWidthPx,
      frames: input.frames,
      winnerFilmId: input.winnerFilmId,
    });
    const startOffset = landing.offsetPx - shuffleSlowDistancePx();
    state = {
      windDownStartMs: (startOffset / SHUFFLE_MOTION.cruisePxPerSec) * 1000,
      landingOffsetPx: landing.offsetPx,
      landingIndex: landing.index,
    };
  }

  if (
    state.windDownStartMs == null ||
    state.landingOffsetPx == null ||
    input.elapsedMs < state.windDownStartMs
  ) {
    return {
      state,
      phase: "cruise",
      offsetPx: shuffleCruiseOffsetPx(input.elapsedMs),
      highlightOpacity: 0,
      expandProgress: 0,
      landingIndex: state.landingIndex,
    };
  }

  const since = input.elapsedMs - state.windDownStartMs;
  const startOffset = shuffleCruiseOffsetPx(state.windDownStartMs);
  const landingOffset = state.landingOffsetPx;
  const highlightMs =
    SHUFFLE_MOTION.highlightRiseMs +
    SHUFFLE_MOTION.highlightHoldMs +
    SHUFFLE_MOTION.highlightFadeMs;

  if (since < SHUFFLE_MOTION.slowMs) {
    const u = since / SHUFFLE_MOTION.slowMs;
    return {
      state,
      phase: "slow",
      offsetPx: startOffset + (landingOffset - startOffset) * shuffleSlowEase(u),
      highlightOpacity: 0,
      expandProgress: 0,
      landingIndex: state.landingIndex,
    };
  }

  const afterLand = since - SHUFFLE_MOTION.slowMs;
  if (afterLand < highlightMs) {
    return {
      state,
      phase: "highlight",
      offsetPx: landingOffset,
      highlightOpacity: highlightOpacityAt(afterLand),
      expandProgress: 0,
      landingIndex: state.landingIndex,
    };
  }

  const afterHighlight = afterLand - highlightMs;
  if (afterHighlight < SHUFFLE_MOTION.expandMs) {
    return {
      state,
      phase: "expand",
      offsetPx: landingOffset,
      highlightOpacity: 0,
      expandProgress: afterHighlight / SHUFFLE_MOTION.expandMs,
      landingIndex: state.landingIndex,
    };
  }

  return {
    state,
    phase: "settled",
    offsetPx: landingOffset,
    highlightOpacity: 0,
    expandProgress: 1,
    landingIndex: state.landingIndex,
  };
}
