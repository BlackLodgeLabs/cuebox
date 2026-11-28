import { describe, expect, it } from "vitest";
import { featureMetaLine, primaryServiceName } from "@/lib/feature-line";

describe("feature line", () => {
  it("joins year, genre, runtime, and the streaming service", () => {
    expect(
      featureMetaLine({
        year: 1973,
        genres: ["Folk horror", "Mystery"],
        runtime: 88,
        service: "Prime Video",
      }),
    ).toBe("1973 · Folk horror · 88m · Prime Video");
  });

  it("drops missing parts and prefers a subscription over rent", () => {
    expect(
      featureMetaLine({
        year: null,
        genres: [],
        runtime: 90,
        service: null,
      }),
    ).toBe("90m");
    expect(
      primaryServiceName([
        {
          type: "rent",
          providers: [{ provider_name: "Apple TV" }],
        },
        {
          type: "flatrate",
          providers: [{ provider_name: "Prime Video" }],
        },
      ]),
    ).toBe("Prime Video");
    expect(primaryServiceName([])).toBeNull();
  });
});
