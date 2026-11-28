import { describe, expect, it } from "vitest";
import { fillHomeRows, type HomeRowFilm } from "@/lib/home-rows";

function film(partial: Partial<HomeRowFilm> & Pick<HomeRowFilm, "id" | "title">): HomeRowFilm {
  return {
    posterUrl: null,
    genres: [],
    tones: [],
    emotionalOutcomes: [],
    runtime: null,
    ...partial,
  };
}

const library: HomeRowFilm[] = [
  film({
    id: "witch",
    title: "The Witch",
    genres: ["Horror"],
    tones: ["folk", "dread"],
    runtime: 92,
  }),
  film({
    id: "wicker",
    title: "The Wicker Man",
    genres: ["Folk horror"],
    tones: ["ritual"],
    emotionalOutcomes: ["unease"],
    runtime: 88,
  }),
  film({
    id: "lamb",
    title: "Lamb",
    genres: ["Drama"],
    tones: ["quiet", "unsettling"],
    emotionalOutcomes: ["grief"],
    runtime: 106,
  }),
  film({
    id: "short",
    title: "A Short Comedy",
    genres: ["Comedy"],
    runtime: 80,
  }),
  film({
    id: "burn",
    title: "The Slow Burn",
    genres: ["Thriller"],
    tones: ["slow", "unease"],
    runtime: 130,
  }),
];

describe("fillHomeRows", () => {
  it("fills the four named rails from genre, mood, and runtime", () => {
    const rows = fillHomeRows(library, "2026-11-27");
    const byTitle = Object.fromEntries(rows.map((row) => [row.title, row.films.map((item) => item.id)]));

    expect(rows.map((row) => row.title)).toEqual([
      "Folk dread",
      "Slow-burn unease",
      "Quiet heartbreak",
      "Under 90 minutes",
    ]);
    expect(byTitle["Folk dread"]).toEqual(expect.arrayContaining(["witch", "wicker"]));
    expect(byTitle["Folk dread"]).not.toContain("short");
    expect(byTitle["Slow-burn unease"]).toEqual(expect.arrayContaining(["burn", "lamb"]));
    expect(byTitle["Slow-burn unease"]).not.toContain("short");
    expect(byTitle["Quiet heartbreak"]).toEqual(["lamb"]);
    expect(byTitle["Under 90 minutes"]).toEqual(expect.arrayContaining(["wicker", "short"]));
    expect(byTitle["Under 90 minutes"]).not.toContain("burn");
  });

  it("points See all at a watchlist filter only where the list can express it", () => {
    const rows = fillHomeRows(library, "2026-11-27");
    const href = Object.fromEntries(rows.map((row) => [row.title, row.seeAllHref]));

    expect(href["Folk dread"]).toBe("/watchlist?genres=Horror,Folk%20horror");
    expect(href["Slow-burn unease"]).toBe("/watchlist");
    expect(href["Quiet heartbreak"]).toBe("/watchlist?genres=Drama");
    expect(href["Under 90 minutes"]).toBe("/watchlist?runtime=le_90");
  });

  it("rotates a rail when the UK date changes and drops an empty rail", () => {
    const folk = [
      film({ id: "a", title: "Alpha", genres: ["Horror"], tones: ["folk", "dread"], runtime: 100 }),
      film({ id: "b", title: "Bravo", genres: ["Horror"], tones: ["folk", "dread"], runtime: 100 }),
      film({ id: "c", title: "Charlie", genres: ["Horror"], tones: ["folk", "dread"], runtime: 100 }),
    ];
    const first = fillHomeRows(folk, "2026-11-27")[0]?.films.map((item) => item.id);
    const next = fillHomeRows(folk, "2026-11-28")[0]?.films.map((item) => item.id);

    // Title order Alpha, Bravo, Charlie, then rotate by the UK-date seed.
    // 2026-11-27 seeds 0; 2026-11-28 seeds 1.
    expect(first).toEqual(["a", "b", "c"]);
    expect(next).toEqual(["b", "c", "a"]);
    expect(fillHomeRows([folk[0]!], "2026-11-27").map((row) => row.title)).toEqual([
      "Folk dread",
    ]);
  });
});
