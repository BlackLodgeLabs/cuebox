import { ukDateSeed } from "@/lib/today-feature";

export interface HomeRowFilm {
  id: string;
  title: string;
  posterUrl: string | null;
  genres: string[];
  tones: string[];
  emotionalOutcomes: string[];
  runtime: number | null;
}

export interface HomeRow {
  id: "folk-dread" | "slow-burn-unease" | "quiet-heartbreak" | "under-90";
  title: string;
  seeAllHref: string;
  films: HomeRowFilm[];
}

const FOLK = ["folk", "pagan", "witch", "ritual", "occult"];
const DREAD = ["dread", "horror", "unease", "unsettling", "ominous", "terror"];
const UNEASE = ["unease", "unsettling", "dread", "tense", "ominous", "creeping", "anxiety"];
const SLOW = ["slow", "patient", "lingering", "meditative"];
const HEARTBREAK = [
  "heartbreak",
  "grief",
  "melancholy",
  "sorrow",
  "loss",
  "lonely",
  "bittersweet",
  "mourning",
];
const QUIET = ["quiet", "intimate", "still", "gentle", "tender", "hushed"];

const SLOW_RUNTIME_MINUTES = 105;

function moodText(film: HomeRowFilm): string {
  return [...film.genres, ...film.tones, ...film.emotionalOutcomes].join(" ").toLowerCase();
}

function hasWord(text: string, words: readonly string[]): boolean {
  return words.some((word) => text.includes(word));
}

function isFolkDread(film: HomeRowFilm): boolean {
  const text = moodText(film);
  return hasWord(text, FOLK) && hasWord(text, DREAD);
}

function isSlowBurn(film: HomeRowFilm): boolean {
  const text = moodText(film);
  const uneasy = hasWord(text, UNEASE);
  const slow =
    hasWord(text, SLOW) || (film.runtime !== null && film.runtime >= SLOW_RUNTIME_MINUTES);
  return uneasy && slow;
}

function isQuietHeartbreak(film: HomeRowFilm): boolean {
  const text = moodText(film);
  const heartbroken = hasWord(text, HEARTBREAK);
  const quiet =
    hasWord(text, QUIET) || film.genres.some((genre) => genre.toLowerCase() === "drama");
  return heartbroken && quiet;
}

function isUnder90(film: HomeRowFilm): boolean {
  return film.runtime !== null && film.runtime > 0 && film.runtime <= 90;
}

function ordered(films: HomeRowFilm[], ukDate: string): HomeRowFilm[] {
  const sorted = [...films].sort(
    (a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id),
  );
  if (sorted.length < 2) return sorted;
  const shift = ukDateSeed(ukDate) % sorted.length;
  return [...sorted.slice(shift), ...sorted.slice(0, shift)];
}

const RULES: {
  id: HomeRow["id"];
  title: string;
  seeAllHref: string;
  match: (film: HomeRowFilm) => boolean;
}[] = [
  {
    id: "folk-dread",
    title: "Folk dread",
    seeAllHref: "/watchlist?genres=Horror,Folk%20horror",
    match: isFolkDread,
  },
  {
    id: "slow-burn-unease",
    title: "Slow-burn unease",
    seeAllHref: "/watchlist",
    match: isSlowBurn,
  },
  {
    id: "quiet-heartbreak",
    title: "Quiet heartbreak",
    seeAllHref: "/watchlist?genres=Drama",
    match: isQuietHeartbreak,
  },
  {
    id: "under-90",
    title: "Under 90 minutes",
    seeAllHref: "/watchlist?runtime=le_90",
    match: isUnder90,
  },
];

/** The only place a watchlist film is assigned to a Home rail. */
export function fillHomeRows(films: HomeRowFilm[], ukDate: string): HomeRow[] {
  return RULES.flatMap((rule) => {
    const matched = ordered(films.filter(rule.match), ukDate);
    if (matched.length === 0) return [];
    return [
      {
        id: rule.id,
        title: rule.title,
        seeAllHref: rule.seeAllHref,
        films: matched,
      },
    ];
  });
}
