import { describe, expect, it } from "vitest";
import { todayFeatureOffset, ukCalendarDate } from "@/lib/today-feature";

describe("today's feature", () => {
  it("uses the UK calendar date, including the summer offset", () => {
    expect(ukCalendarDate(new Date("2026-11-27T12:00:00Z"))).toBe("2026-11-27");
    expect(ukCalendarDate(new Date("2026-11-27T23:30:00Z"))).toBe("2026-11-27");
    expect(ukCalendarDate(new Date("2026-07-15T23:30:00Z"))).toBe("2026-07-16");
  });

  it("stays on the same watchlist slot for a UK day and moves the next day", () => {
    expect(todayFeatureOffset(10, "2026-11-27")).toBe(5);
    expect(todayFeatureOffset(10, "2026-11-27")).toBe(5);
    expect(todayFeatureOffset(10, "2026-11-28")).toBe(6);
  });

  it("returns 0 when the watchlist is empty and stays inside the list", () => {
    expect(todayFeatureOffset(0, "2026-11-27")).toBe(0);
    expect(todayFeatureOffset(1, "2026-11-28")).toBe(0);
    const offset = todayFeatureOffset(17, "2026-01-01");
    expect(offset).toBe(0);
    expect(offset).toBeGreaterThanOrEqual(0);
    expect(offset).toBeLessThan(17);
  });
});
