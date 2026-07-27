export type CeremonyStage = 1 | 2 | 3;

const armedSessions = new Set<string>();

export function armCeremonyGate(sessionId: string): void {
  armedSessions.add(sessionId);
}

export function isCeremonyArmed(sessionId: string): boolean {
  return armedSessions.has(sessionId);
}

export function clearCeremonyGate(sessionId: string): void {
  armedSessions.delete(sessionId);
}

/** Invalid or missing stage → 3 (durable session record). */
export function parseStage(value: string | null | undefined): CeremonyStage {
  if (value === "1") return 1;
  if (value === "2") return 2;
  return 3;
}

export function buildStageHref(
  pathname: string,
  stage: CeremonyStage,
  currentSearchParams?: URLSearchParams | { toString(): string },
): string {
  const params = new URLSearchParams(
    currentSearchParams ? currentSearchParams.toString() : "",
  );
  params.set("stage", String(stage));
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : `${pathname}?stage=${stage}`;
}

/** Unarmed stage 1|2 (hard refresh / deep link) must land on stage 3. */
export function shouldCoerceToStage3(
  stage: CeremonyStage,
  sessionId: string,
): boolean {
  return (stage === 1 || stage === 2) && !isCeremonyArmed(sessionId);
}

/** Test-only: clear module-scoped arms between cases. */
export function __resetCeremonyGatesForTests(): void {
  armedSessions.clear();
}
