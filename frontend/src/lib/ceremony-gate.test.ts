import { afterEach, describe, expect, it } from "vitest";
import {
  __resetCeremonyGatesForTests,
  armCeremonyGate,
  buildStageHref,
  clearCeremonyGate,
  isCeremonyArmed,
  parseStage,
  shouldCoerceToStage3,
} from "@/lib/ceremony-gate";

describe("ceremony-gate", () => {
  afterEach(() => {
    __resetCeremonyGatesForTests();
  });

  it("parseStage maps 1|2 and defaults invalid/missing to 3", () => {
    expect(parseStage("1")).toBe(1);
    expect(parseStage("2")).toBe(2);
    expect(parseStage("3")).toBe(3);
    expect(parseStage(null)).toBe(3);
    expect(parseStage(undefined)).toBe(3);
    expect(parseStage("")).toBe(3);
    expect(parseStage("9")).toBe(3);
    expect(parseStage("foo")).toBe(3);
  });

  it("buildStageHref sets stage and preserves unrelated params", () => {
    const params = new URLSearchParams("dev=1&stage=1");
    expect(buildStageHref("/recommend/results/abc", 2, params)).toBe(
      "/recommend/results/abc?dev=1&stage=2",
    );
    expect(buildStageHref("/history/abc", 3)).toBe("/history/abc?stage=3");
  });

  it("arms, checks, and clears the module-scoped gate", () => {
    expect(isCeremonyArmed("s1")).toBe(false);
    armCeremonyGate("s1");
    expect(isCeremonyArmed("s1")).toBe(true);
    expect(isCeremonyArmed("s2")).toBe(false);
    clearCeremonyGate("s1");
    expect(isCeremonyArmed("s1")).toBe(false);
  });

  it("coerces unarmed stage 1|2 to stage 3; armed stages pass", () => {
    expect(shouldCoerceToStage3(1, "s1")).toBe(true);
    expect(shouldCoerceToStage3(2, "s1")).toBe(true);
    expect(shouldCoerceToStage3(3, "s1")).toBe(false);

    armCeremonyGate("s1");
    expect(shouldCoerceToStage3(1, "s1")).toBe(false);
    expect(shouldCoerceToStage3(2, "s1")).toBe(false);
    expect(shouldCoerceToStage3(3, "s1")).toBe(false);
  });
});
