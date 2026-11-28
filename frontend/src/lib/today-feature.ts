/** Daily watchlist slot. The same UK date always yields the same offset. */

const UK_TIME_ZONE = "Europe/London";

export function ukCalendarDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: UK_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Unsigned 32-bit seed from a YYYY-MM-DD string. */
export function ukDateSeed(ukDate: string): number {
  let hash = 0;
  for (let index = 0; index < ukDate.length; index += 1) {
    hash = (hash * 33 + ukDate.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function todayFeatureOffset(total: number, ukDate: string): number {
  if (total <= 0) return 0;
  return ukDateSeed(ukDate) % total;
}
