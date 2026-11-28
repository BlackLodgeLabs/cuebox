/**
 * One-shot handoff from the shuffle into `/recommend/results`.
 * A reload starts fresh, so the programme shows without the strip.
 */

const settledSessions = new Set<string>();
let suppressedPath: string | null = null;

export function markProgrammeSettled(sessionId: string): void {
  settledSessions.add(sessionId);
}

export function peekProgrammeSettled(sessionId: string): boolean {
  return settledSessions.has(sessionId);
}

export function consumeProgrammeSettled(sessionId: string): void {
  settledSessions.delete(sessionId);
}

export function suppressNextScreenFade(pathname: string): void {
  suppressedPath = pathname;
}

export function isScreenFadeSuppressed(pathname: string): boolean {
  return suppressedPath === pathname;
}

/** Test-only reset. */
export function __resetRecommendHandoffForTests(): void {
  settledSessions.clear();
  suppressedPath = null;
}
