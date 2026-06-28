import { describe, expect, it } from "vitest";
import {
  MOOD_PRESETS,
  buildQuestionnaireFromPreset,
  isKnownMoodPresetId,
} from "@/lib/mood-presets";
import {
  ALL_GENRE_LABELS,
  EMOTIONAL_OUTCOMES,
  NO_PREFERENCE,
  VISUAL_TONAL_VIBES,
} from "@/lib/questionnaire-vocabulary";

describe("mood presets", () => {
  it("defines six presets with unique ids", () => {
    expect(MOOD_PRESETS).toHaveLength(6);
    const ids = MOOD_PRESETS.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(6);
  });

  it("each preset builds a complete questionnaire", () => {
    for (const preset of MOOD_PRESETS) {
      const questionnaire = buildQuestionnaireFromPreset(preset.id);
      expect(questionnaire.genres.length).toBeGreaterThan(0);
      expect(questionnaire.emotional_outcomes.length).toBeGreaterThan(0);
      expect(questionnaire.visual_tonal_vibes.length).toBeGreaterThan(0);
      expect(questionnaire.runtime).toBeTruthy();
      expect(questionnaire.era).toBeTruthy();
    }
  });

  it("uses only existing vocabulary values", () => {
    for (const preset of MOOD_PRESETS) {
      const questionnaire = buildQuestionnaireFromPreset(preset.id);
      for (const genre of questionnaire.genres) {
        expect(ALL_GENRE_LABELS).toContain(genre);
      }
      for (const outcome of questionnaire.emotional_outcomes) {
        expect(EMOTIONAL_OUTCOMES).toContain(outcome);
        expect(outcome).not.toBe(NO_PREFERENCE);
      }
      for (const vibe of questionnaire.visual_tonal_vibes) {
        expect(VISUAL_TONAL_VIBES).toContain(vibe);
        expect(vibe).not.toBe(NO_PREFERENCE);
      }
    }
  });

  it("matches backend quick-pick preset ids", () => {
    const backendIds = [
      "cozy_night_in",
      "adrenaline_rush",
      "deep_and_arty",
      "scare_me",
      "feel_good_escape",
      "dark_and_unsettling",
    ];
    for (const id of backendIds) {
      expect(isKnownMoodPresetId(id)).toBe(true);
    }
  });
});
