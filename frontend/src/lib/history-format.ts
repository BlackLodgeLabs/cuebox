import type { FilmStatus } from "@/types/api";

/** Same zone as the dated programme, so a ticket and its night title agree. */
const HISTORY_TIME_ZONE = "Europe/London";

export function formatNightCount(total: number): string {
  return total === 1 ? "1 night" : `${total} nights`;
}

export function historyMonthLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: HISTORY_TIME_ZONE,
    month: "long",
    year: "numeric",
  }).format(date);
}

export function historyStubParts(iso: string): {
  weekday: string;
  day: string;
  month: string;
} {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return { weekday: "", day: "", month: "" };
  }
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: HISTORY_TIME_ZONE,
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    weekday: read("weekday").toUpperCase(),
    day: read("day"),
    month: read("month").toUpperCase(),
  };
}

/** Watched is teal. Unwatched and Archived stay muted. Runner-up watched stays a mark. */
export function historyWatchMark(
  tag: string | null,
  status: FilmStatus | null,
): { label: string; watched: boolean } {
  const value = tag ?? status;
  if (value === "runner_up_watched") {
    return { label: "Runner-up watched", watched: true };
  }
  if (value === "watched") {
    return { label: "Watched", watched: true };
  }
  if (value === "archived") {
    return { label: "Archived", watched: false };
  }
  return { label: "Unwatched", watched: false };
}
