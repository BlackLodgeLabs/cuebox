import type { WatchProviderCategory, WatchProviderCategoryType } from "@/types/api";

/** UK local time for programme copy. November stays on GMT, so 20:41Z is 20:41. */
const PROGRAMME_TIME_ZONE = "Europe/London";

/** Pack title. The motion tester uses a typographic apostrophe. */
export const TONIGHT_PROGRAMME_TITLE = "Tonight’s programme";

const SERVICE_ORDER: WatchProviderCategoryType[] = ["flatrate", "ads", "rent", "buy"];

export function formatProgrammeDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: PROGRAMME_TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).formatToParts(date);
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  return [weekday, day, month].filter(Boolean).join(" ");
}

export function formatProgrammeClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: PROGRAMME_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

/** Drop a trailing full stop so the sub-line does not end mid-separator. */
export function preferenceSummaryText(narrative: string | null | undefined): string {
  const trimmed = narrative?.trim() ?? "";
  if (!trimmed) return "";
  return trimmed.replace(/\.$/, "");
}

export function programmeSubline(createdAt: string, summary: string): string {
  const time = formatProgrammeClock(createdAt);
  if (!time && !summary) return "";
  if (!time) return summary;
  if (!summary) return `From your pick at ${time}`;
  return `From your pick at ${time} · ${summary}`;
}

export function runtimeLabel(runtime: number | null | undefined): string | null {
  if (runtime == null || !Number.isFinite(runtime) || runtime <= 0) return null;
  return `${runtime}m`;
}

export function filmMetaLine(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => part?.trim() ?? "")
    .filter((part) => part.length > 0)
    .join(" · ");
}

/** Year, first genre, runtime, and an optional service. Empty parts are dropped. */
export function filmDetailLine(
  film: { year: number | null; genres?: string[] | null; runtime: number | null },
  service?: string | null,
): string {
  return filmMetaLine([
    film.year != null ? String(film.year) : null,
    film.genres?.find((genre) => genre.trim())?.trim() ?? null,
    runtimeLabel(film.runtime),
    service,
  ]);
}

/** Stream (flatrate) first, then ads, rent, and buy. */
export function firstServiceName(
  categories: WatchProviderCategory[] | undefined,
): string | null {
  if (!categories || categories.length === 0) return null;
  for (const type of SERVICE_ORDER) {
    const category = categories.find((item) => item.type === type);
    const name = category?.providers.find((provider) => provider.provider_name.trim());
    if (name) return name.provider_name.trim();
  }
  return null;
}
