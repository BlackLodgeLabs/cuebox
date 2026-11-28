import { describe, expect, it } from "vitest";
import { filmDetailLine, firstServiceName } from "@/lib/programme-format";

describe("film detail line", () => {
  it("joins year, genre, runtime, and the streaming service", () => {
    expect(
      filmDetailLine(
        {
          year: 1973,
          genres: ["Folk horror", "Mystery"],
          runtime: 88,
        },
        "Prime Video",
      ),
    ).toBe("1973 · Folk horror · 88m · Prime Video");
  });

  it("drops missing parts and prefers a subscription over rent", () => {
    expect(filmDetailLine({ year: null, genres: [], runtime: 90 }, null)).toBe("90m");
    expect(
      firstServiceName([
        {
          type: "rent",
          label: "Rent",
          providers: [
            {
              provider_id: 2,
              provider_name: "Apple TV",
              logo_url: null,
              display_priority: 2,
            },
          ],
        },
        {
          type: "flatrate",
          label: "Stream",
          providers: [
            {
              provider_id: 9,
              provider_name: "Prime Video",
              logo_url: null,
              display_priority: 1,
            },
          ],
        },
      ]),
    ).toBe("Prime Video");
    expect(firstServiceName([])).toBeNull();
  });
});
