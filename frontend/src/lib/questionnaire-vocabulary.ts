/**
 * Controlled vocabulary for the recommendation questionnaire.
 * Sources: PRD §11, api-contracts Appendix C, and test fixtures (Horror, Folk Horror, etc.).
 */

export const NO_PREFERENCE = "No Preference";

export interface GenreNode {
  label: string;
  children?: GenreNode[];
}

export const GENRE_HIERARCHY: GenreNode[] = [
  {
    label: "Horror",
    children: [
      { label: "Folk Horror" },
      { label: "Psychological Horror" },
      { label: "Supernatural Horror" },
      { label: "Slasher" },
      { label: "Body Horror" },
    ],
  },
  {
    label: "Drama",
    children: [
      { label: "Coming-of-Age" },
      { label: "Family Drama" },
      { label: "Crime Drama" },
    ],
  },
  {
    label: "Comedy",
    children: [
      { label: "Dark Comedy" },
      { label: "Romantic Comedy" },
      { label: "Satire" },
    ],
  },
  {
    label: "Science Fiction",
    children: [
      { label: "Cyberpunk" },
      { label: "Space Opera" },
      { label: "Dystopian" },
    ],
  },
  {
    label: "Thriller",
    children: [
      { label: "Neo-Noir" },
      { label: "Psychological Thriller" },
      { label: "Crime Thriller" },
    ],
  },
  {
    label: "Action",
    children: [{ label: "Martial Arts" }, { label: "Heist" }],
  },
  {
    label: "Romance",
    children: [{ label: "Melodrama" }],
  },
  {
    label: "Documentary",
    children: [{ label: "True Crime" }],
  },
  {
    label: "Animation",
    children: [{ label: "Anime" }],
  },
  {
    label: "Fantasy",
    children: [{ label: "High Fantasy" }, { label: "Urban Fantasy" }],
  },
];

export function flattenGenreLabels(nodes: GenreNode[]): string[] {
  const labels: string[] = [];
  for (const node of nodes) {
    labels.push(node.label);
    if (node.children) {
      labels.push(...flattenGenreLabels(node.children));
    }
  }
  return labels;
}

export const ALL_GENRE_LABELS = flattenGenreLabels(GENRE_HIERARCHY);

export const EMOTIONAL_OUTCOMES = [
  NO_PREFERENCE,
  "Inspired",
  "Comforted",
  "Terrified",
  "Mind-blown",
  "Emotionally wrecked",
  "Amused",
  "Disturbed",
  "Unsettled",
  "Hopeful",
  "Reflective",
  "Energized",
  "Melancholic",
];

export const VISUAL_TONAL_VIBES = [
  NO_PREFERENCE,
  "Gritty",
  "Bright",
  "Cozy",
  "Arty",
  "Atmospheric",
  "Stylized",
  "Naturalistic",
  "Neon",
  "Muted",
  "Surreal",
  "Sun-drenched",
  "Noir",
];

export const RUNTIME_OPTIONS = [
  { value: "le_90" as const, label: "≤ 90 minutes" },
  { value: "le_120" as const, label: "≤ 120 minutes" },
  { value: "le_150" as const, label: "≤ 150 minutes" },
  { value: "any" as const, label: "No limit" },
];

export const VIEWING_CONTEXT_OPTIONS = [
  { value: "solo" as const, label: "Solo viewing" },
  { value: "with_others" as const, label: "With others" },
];

export const THINKING_EFFORT_OPTIONS = [
  { value: "brain_off" as const, label: "Brain-off entertainment" },
  { value: "decent_plot" as const, label: "Follow a decent plot" },
  { value: "complex_puzzle" as const, label: "Complex puzzle" },
];

export const PACING_OPTIONS = [
  { value: "slow_burn" as const, label: "Slow burn" },
  { value: "balanced" as const, label: "Balanced" },
  { value: "fast_paced" as const, label: "Fast paced" },
  { value: "no_preference" as const, label: "No preference" },
];

export const ERA_OPTIONS = [
  { value: "current" as const, label: "2020s" },
  { value: "modern_classics" as const, label: "1990s–2010s" },
  { value: "vintage" as const, label: "Pre-1990" },
  { value: "no_preference" as const, label: "No preference" },
];

export const SUBTITLE_OPTIONS = [
  { value: "yes" as const, label: "Subtitles OK" },
  { value: "no" as const, label: "No subtitles" },
  { value: "no_preference" as const, label: "No preference" },
];

export const OBSCURITY_OPTIONS = [
  { value: "mainstream" as const, label: "Mainstream" },
  { value: "hidden_gems" as const, label: "Hidden gems" },
  { value: "obscure" as const, label: "Obscure" },
  { value: "no_preference" as const, label: "No preference" },
];

export function toggleMultiSelect(current: string[], value: string): string[] {
  if (value === NO_PREFERENCE) {
    return current.includes(NO_PREFERENCE) ? [] : [NO_PREFERENCE];
  }
  const withoutNoPref = current.filter((v) => v !== NO_PREFERENCE);
  if (withoutNoPref.includes(value)) {
    return withoutNoPref.filter((v) => v !== value);
  }
  return [...withoutNoPref, value];
}

export function hasNoPreferenceConflict(values: string[]): boolean {
  return values.includes(NO_PREFERENCE) && values.length > 1;
}

export const DEFAULT_QUESTIONNAIRE = {
  genres: [] as string[],
  runtime: "le_120" as const,
  viewing_context: "solo" as const,
  thinking_effort: "decent_plot" as const,
  pacing: "slow_burn" as const,
  emotional_outcomes: [] as string[],
  visual_tonal_vibes: [] as string[],
  era: "modern_classics" as const,
  subtitle_preference: "no_preference" as const,
  obscurity_preference: "hidden_gems" as const,
};
