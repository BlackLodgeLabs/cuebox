import { describe, expect, it } from "vitest";
import { formatFilmStatusLabel } from "@/lib/film-status-label";

describe("formatFilmStatusLabel", () => {
  it.each([
    ["active", "On watchlist"],
    ["pending_watch_review", "Needs watch review"],
    ["watched", "Watched"],
    ["archived", "Archived"],
  ] as const)("maps %s → %s", (status, label) => {
    expect(formatFilmStatusLabel(status)).toBe(label);
  });

  it("falls back for unknown statuses", () => {
    expect(formatFilmStatusLabel("custom_status")).toBe("custom status");
  });
});
