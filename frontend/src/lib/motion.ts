/**
 * App-wide motion from the Nov 2026 design pack (README §6.6).
 * Locked durations live here and in `styles/tokens.css`. Resolvers read the
 * CSS variables when the document has them, and fall back to the lock.
 * Reduced motion is a 300ms fade or an instant settle: no travel, scale, or glow.
 */

export const cueboxEase: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const sheetTransition = {
  open: { duration: 0.8, ease: cueboxEase },
  close: { duration: 0.7, ease: cueboxEase },
};

export const toastTransition = {
  enter: { duration: 0.7, ease: cueboxEase },
  exit: { duration: 0.6, ease: cueboxEase },
};

export const searchTransition = {
  open: { duration: 0.7, ease: cueboxEase },
  close: { duration: 0.6, ease: cueboxEase },
};

export const REDUCED_FADE_MS = 300;
export const SHEET_DISMISS_PX = 120;
export const SEARCH_FROM_SCALE = 0.96;
/** Search card dim from the locked app-wide tester (`motion/06-app-wide`). */
export const SEARCH_DIM = 0.72;

export type CueEase = [number, number, number, number] | "linear";

export type CueTransition = {
  duration: number;
  ease: CueEase;
};

function seconds(ms: number): number {
  return ms / 1000;
}

function fade(ms = REDUCED_FADE_MS): CueTransition {
  return { duration: seconds(ms), ease: "linear" };
}

/** Read a token. Accepts `800ms`, `0.8s`, or a unitless number. */
export function readCssNumber(name: string, fallback: number): number {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return fallback;
  }
  const raw = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!raw) return fallback;
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value)) return fallback;
  if (raw.endsWith("ms")) return value;
  if (raw.endsWith("s")) return value * 1000;
  return value;
}

/**
 * Fraction of the drawer height Vaul should treat as a dismiss.
 * 120px on a 600px sheet is 0.2. A sheet shorter than the threshold
 * dismisses only after it has travelled its full height.
 */
export function sheetCloseThreshold(
  drawerHeightPx: number,
  dismissPx = SHEET_DISMISS_PX,
): number {
  if (!Number.isFinite(drawerHeightPx) || drawerHeightPx <= 0) return 1;
  return Math.min(1, dismissPx / drawerHeightPx);
}

export function sheetMotion(reduced: boolean) {
  const dismissPx = readCssNumber("--cb-sheet-dismiss-px", SHEET_DISMISS_PX);
  const dim = readCssNumber("--cb-sheet-dim", 0.55);
  if (reduced) {
    return {
      open: fade(),
      close: fade(),
      openMs: REDUCED_FADE_MS,
      closeMs: REDUCED_FADE_MS,
      dim,
      dimFadeMs: REDUCED_FADE_MS,
      dismissPx,
      travel: "none" as const,
    };
  }
  const openMs = readCssNumber("--cb-sheet-up", sheetTransition.open.duration * 1000);
  const closeMs = readCssNumber("--cb-sheet-down", sheetTransition.close.duration * 1000);
  const dimFadeMs = readCssNumber("--cb-sheet-dim-fade", 450);
  return {
    open: { duration: seconds(openMs), ease: cueboxEase },
    close: { duration: seconds(closeMs), ease: cueboxEase },
    openMs,
    closeMs,
    dim,
    dimFadeMs,
    dismissPx,
    travel: "y" as const,
  };
}

export function toastMotion(reduced: boolean) {
  const stayMs = readCssNumber("--cb-toast-stay", 2800);
  const radiusPx = 12;
  if (reduced) {
    return {
      enter: fade(),
      exit: fade(),
      enterMs: REDUCED_FADE_MS,
      exitMs: REDUCED_FADE_MS,
      travelPx: 0,
      stayMs,
      radiusPx,
    };
  }
  const enterMs = readCssNumber("--cb-toast-in", toastTransition.enter.duration * 1000);
  const exitMs = readCssNumber("--cb-toast-out", toastTransition.exit.duration * 1000);
  const travelPx = readCssNumber("--cb-toast-travel", 20);
  return {
    enter: { duration: seconds(enterMs), ease: cueboxEase },
    exit: { duration: seconds(exitMs), ease: cueboxEase },
    enterMs,
    exitMs,
    travelPx,
    stayMs,
    radiusPx,
  };
}

export function searchMotion(reduced: boolean) {
  const dim = SEARCH_DIM;
  if (reduced) {
    return {
      open: fade(),
      close: fade(),
      openMs: REDUCED_FADE_MS,
      closeMs: REDUCED_FADE_MS,
      fromScale: 1,
      dim,
      travel: "none" as const,
    };
  }
  const openMs = readCssNumber("--cb-search-open", searchTransition.open.duration * 1000);
  const closeMs = readCssNumber("--cb-search-close", searchTransition.close.duration * 1000);
  const fromScale = readCssNumber("--cb-search-from-scale", SEARCH_FROM_SCALE);
  return {
    open: { duration: seconds(openMs), ease: cueboxEase },
    close: { duration: seconds(closeMs), ease: cueboxEase },
    openMs,
    closeMs,
    fromScale,
    dim,
    travel: "scale" as const,
  };
}

export function confirmMotion(reduced: boolean) {
  const dim = readCssNumber("--cb-dialog-dim", 0.62);
  const radiusPx = 16;
  if (reduced) {
    return {
      transition: fade(),
      durationMs: REDUCED_FADE_MS,
      fromScale: 1,
      dim,
      radiusPx,
      travel: "none" as const,
    };
  }
  const durationMs = readCssNumber("--cb-dialog-dur", 400);
  const fromScale = readCssNumber("--cb-dialog-from-scale", 0.92);
  return {
    transition: { duration: seconds(durationMs), ease: cueboxEase },
    durationMs,
    fromScale,
    dim,
    radiusPx,
    travel: "scale" as const,
  };
}

export function pressMotion(reduced: boolean) {
  if (reduced) {
    return { scale: 1, downMs: 0, upMs: 0 };
  }
  return {
    scale: readCssNumber("--cb-press-scale", 0.96),
    downMs: readCssNumber("--cb-press-down", 120),
    upMs: readCssNumber("--cb-press-up", 200),
  };
}

export function screenMotion(reduced: boolean) {
  if (reduced) {
    return { fadeMs: REDUCED_FADE_MS, transition: fade() };
  }
  const fadeMs = readCssNumber("--cb-screen-fade", 400);
  return {
    fadeMs,
    transition: { duration: seconds(fadeMs), ease: cueboxEase },
  };
}

export function numberMotion(reduced: boolean) {
  if (reduced) {
    return { durationMs: 0, settled: true };
  }
  return {
    durationMs: readCssNumber("--cb-numberflow", 400),
    settled: false,
  };
}

export function revealMotion(reduced: boolean) {
  const durationMs = readCssNumber("--cb-synopsis-more", REDUCED_FADE_MS);
  if (reduced) {
    return {
      durationMs: REDUCED_FADE_MS,
      animateHeight: false,
      transition: fade(),
    };
  }
  return {
    durationMs,
    animateHeight: true,
    transition: { duration: seconds(durationMs), ease: cueboxEase },
  };
}

export function batchMotion(reduced: boolean) {
  const fadeMs = readCssNumber("--cb-watchlist-batch-fade", REDUCED_FADE_MS);
  if (reduced) {
    return { fadeMs: REDUCED_FADE_MS, staggerMs: 0 };
  }
  return {
    fadeMs,
    staggerMs: readCssNumber("--cb-watchlist-batch-stagger", 30),
  };
}
