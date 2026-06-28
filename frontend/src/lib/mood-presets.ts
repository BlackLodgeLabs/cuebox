import {
  DEFAULT_QUESTIONNAIRE,
  EMOTIONAL_OUTCOMES,
  VISUAL_TONAL_VIBES,
} from "@/lib/questionnaire-vocabulary";
import type { Questionnaire } from "@/types/api";

export interface MoodPreset {
  id: string;
  label: string;
  description: string;
  icon: string;
  overrides: Partial<Questionnaire>;
}

export const MOOD_PRESETS: MoodPreset[] = [
  {
    id: "cozy_night_in",
    label: "Cozy night in",
    description: "Warm, slow-burn drama to unwind with",
    icon: "local_cafe",
    overrides: {
      genres: ["Drama"],
      emotional_outcomes: ["Comforted"],
      visual_tonal_vibes: ["Cozy", "Muted"],
      pacing: "slow_burn",
      thinking_effort: "brain_off",
    },
  },
  {
    id: "adrenaline_rush",
    label: "Adrenaline rush",
    description: "Fast action and high-energy thrills",
    icon: "bolt",
    overrides: {
      genres: ["Action", "Thriller"],
      emotional_outcomes: ["Energized"],
      visual_tonal_vibes: ["Gritty", "Neon"],
      pacing: "fast_paced",
      thinking_effort: "brain_off",
    },
  },
  {
    id: "deep_and_arty",
    label: "Deep & arty",
    description: "Reflective, visually rich cinema",
    icon: "palette",
    overrides: {
      genres: ["Drama"],
      emotional_outcomes: ["Reflective", "Mind-blown"],
      visual_tonal_vibes: ["Arty", "Atmospheric"],
      pacing: "slow_burn",
      thinking_effort: "complex_puzzle",
    },
  },
  {
    id: "scare_me",
    label: "Scare me",
    description: "Horror with dread and atmosphere",
    icon: "nightlight",
    overrides: {
      genres: ["Horror"],
      emotional_outcomes: ["Terrified"],
      visual_tonal_vibes: ["Atmospheric", "Gritty"],
      pacing: "balanced",
      thinking_effort: "decent_plot",
    },
  },
  {
    id: "feel_good_escape",
    label: "Feel-good escape",
    description: "Light comedy to lift your mood",
    icon: "sentiment_satisfied",
    overrides: {
      genres: ["Comedy"],
      emotional_outcomes: ["Amused", "Hopeful"],
      visual_tonal_vibes: ["Bright", "Sun-drenched"],
      pacing: "balanced",
      thinking_effort: "brain_off",
    },
  },
  {
    id: "dark_and_unsettling",
    label: "Dark & unsettling",
    description: "Slow-burn noir with unease",
    icon: "contrast",
    overrides: {
      genres: ["Thriller"],
      emotional_outcomes: ["Disturbed", "Unsettled"],
      visual_tonal_vibes: ["Noir", "Muted"],
      pacing: "slow_burn",
      thinking_effort: "decent_plot",
    },
  },
];

const PRESET_IDS = new Set(MOOD_PRESETS.map((preset) => preset.id));

export function buildQuestionnaireFromPreset(id: string): Questionnaire {
  const preset = MOOD_PRESETS.find((item) => item.id === id);
  if (!preset) {
    throw new Error(`Unknown mood preset: ${id}`);
  }
  const questionnaire: Questionnaire = {
    ...DEFAULT_QUESTIONNAIRE,
    ...preset.overrides,
  };
  if (
    questionnaire.genres.length === 0 ||
    questionnaire.emotional_outcomes.length === 0 ||
    questionnaire.visual_tonal_vibes.length === 0
  ) {
    throw new Error(`Preset ${id} produced an incomplete questionnaire`);
  }
  return questionnaire;
}

export function isKnownMoodPresetId(id: string): boolean {
  return PRESET_IDS.has(id);
}

export const MOOD_PRESET_VOCABULARY = {
  emotional_outcomes: EMOTIONAL_OUTCOMES,
  visual_tonal_vibes: VISUAL_TONAL_VIBES,
};
