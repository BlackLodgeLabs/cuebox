"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RecommendCue } from "@/components/recommend-cue";
import {
  QUESTION_STEPS,
  RecommendQuestionnaire,
  type QuestionStepId,
} from "@/components/recommend-questionnaire";
import { useHoldTabBar } from "@/components/chrome-override";
import { useFilms } from "@/hooks/use-films";
import { useCreateRecommendation } from "@/hooks/use-recommendations";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { ApiClientError } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/error-messages";
import {
  DEFAULT_QUESTIONNAIRE,
  NO_PREFERENCE,
  hasNoPreferenceConflict,
  toggleMultiSelect,
} from "@/lib/questionnaire-vocabulary";
import { buildShuffleReel, type ShuffleFrame } from "@/lib/recommendation-shuffle";
import {
  markProgrammeSettled,
  suppressNextScreenFade,
} from "@/lib/recommend-handoff";
import type { Questionnaire, RecommendationResponse } from "@/types/api";

const API_REACH_MESSAGE =
  "Could not reach the API. Make sure the backend is running.";

type MultiField = "genres" | "emotional_outcomes" | "visual_tonal_vibes";
type SingleField = Exclude<QuestionStepId, MultiField | "notes">;

export default function RecommendPage() {
  const router = useRouter();
  const reduced = useReducedMotion();
  const [stepIndex, setStepIndex] = useState(0);
  const [questionnaire, setQuestionnaire] = useState<Questionnaire>({
    ...DEFAULT_QUESTIONNAIRE,
  });
  const [notes, setNotes] = useState("");
  const [stepError, setStepError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [result, setResult] = useState<RecommendationResponse | null>(null);
  const [showTabs, setShowTabs] = useState(false);
  const submittingRef = useRef(false);
  const create = useCreateRecommendation();
  const films = useFilms({ status: "active", limit: 100 });

  useHoldTabBar(started ? showTabs : false);

  const watchlistFrames = useMemo<ShuffleFrame[]>(
    () =>
      (films.data?.data ?? []).map((film) => ({
        filmId: film.id,
        backdropUrl: film.backdrop_url,
      })),
    [films.data],
  );
  const reel = useMemo(
    () =>
      buildShuffleReel(
        watchlistFrames,
        result
          ? { filmId: result.winner.film_id, backdropUrl: result.winner.backdrop_url }
          : { filmId: "", backdropUrl: null },
      ),
    [result, watchlistFrames],
  );

  const step = QUESTION_STEPS[stepIndex];
  const showQuestions = !started || reduced;
  const coverQuestions = started && reduced && result != null;

  const validateStep = useCallback((): boolean => {
    setStepError(null);
    if (step.id === "genres" && questionnaire.genres.length === 0) {
      setStepError("Select at least one genre or No Preference.");
      return false;
    }
    if (step.id === "genres" && hasNoPreferenceConflict(questionnaire.genres)) {
      setStepError('"No Preference" cannot be combined with other genres.');
      return false;
    }
    if (step.id === "emotional_outcomes" && questionnaire.emotional_outcomes.length === 0) {
      setStepError("Select at least one emotional outcome or No Preference.");
      return false;
    }
    if (
      step.id === "emotional_outcomes" &&
      hasNoPreferenceConflict(questionnaire.emotional_outcomes)
    ) {
      setStepError('"No Preference" cannot be combined with other selections.');
      return false;
    }
    if (step.id === "visual_tonal_vibes" && questionnaire.visual_tonal_vibes.length === 0) {
      setStepError("Select at least one vibe or No Preference.");
      return false;
    }
    if (
      step.id === "visual_tonal_vibes" &&
      hasNoPreferenceConflict(questionnaire.visual_tonal_vibes)
    ) {
      setStepError('"No Preference" cannot be combined with other selections.');
      return false;
    }
    if (step.id === "notes" && notes.length > 1000) {
      setStepError("Notes must be 1000 characters or fewer.");
      return false;
    }
    return true;
  }, [notes.length, questionnaire, step.id]);

  const handleSubmit = useCallback(async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitError(null);
    setStarted(true);
    try {
      const response = await create.mutateAsync({
        questionnaire,
        notes: notes.trim() || undefined,
      });
      setResult(response);
    } catch (error) {
      setStarted(false);
      submittingRef.current = false;
      if (error instanceof ApiClientError) {
        setSubmitError(
          getErrorMessage({
            code: error.code as Parameters<typeof getErrorMessage>[0]["code"],
            message: error.message,
            details: error.details,
          }),
        );
      } else {
        setSubmitError(API_REACH_MESSAGE);
      }
    }
  }, [create, notes, questionnaire]);

  const advance = useCallback(() => {
    if (stepIndex >= QUESTION_STEPS.length - 1) {
      void handleSubmit();
      return;
    }
    setStepIndex((index) => index + 1);
  }, [handleSubmit, stepIndex]);

  const handleNext = () => {
    if (!validateStep()) return;
    advance();
  };

  const handleSkip = () => {
    setStepError(null);
    if (step.id === "genres" && questionnaire.genres.length === 0) {
      setQuestionnaire((current) => ({ ...current, genres: [NO_PREFERENCE] }));
    }
    if (step.id === "emotional_outcomes" && questionnaire.emotional_outcomes.length === 0) {
      setQuestionnaire((current) => ({ ...current, emotional_outcomes: [NO_PREFERENCE] }));
    }
    if (step.id === "visual_tonal_vibes" && questionnaire.visual_tonal_vibes.length === 0) {
      setQuestionnaire((current) => ({ ...current, visual_tonal_vibes: [NO_PREFERENCE] }));
    }
    advance();
  };

  const handleSettled = useCallback(
    (sessionId: string) => {
      markProgrammeSettled(sessionId);
      const path = `/recommend/results/${sessionId}`;
      suppressNextScreenFade(path);
      router.replace(path);
    },
    [router],
  );

  const onTabBar = useCallback((visible: boolean) => {
    setShowTabs(visible);
  }, []);

  return (
    <>
      {showQuestions ? (
        <div aria-hidden={coverQuestions || undefined}>
        <RecommendQuestionnaire
          stepIndex={stepIndex}
          questionnaire={questionnaire}
          notes={notes}
          stepError={stepError}
          submitError={submitError}
          submitting={started}
          onToggle={(field, value) =>
            setQuestionnaire((current) => ({
              ...current,
              [field]: toggleMultiSelect(current[field], value),
            }))
          }
          onSelect={(field: SingleField, value) =>
            setQuestionnaire((current) => ({ ...current, [field]: value }))
          }
          onNotes={setNotes}
          onClose={() => router.push("/")}
          onBack={() => {
            setStepError(null);
            setStepIndex((index) => Math.max(0, index - 1));
          }}
          onSkip={handleSkip}
          onNext={handleNext}
          onRetry={() => void handleSubmit()}
        />
        </div>
      ) : null}
      {started ? (
        <RecommendCue
          frames={reel}
          session={result}
          reduced={reduced}
          onSettled={handleSettled}
          onTabBar={onTabBar}
        />
      ) : null}
    </>
  );
}
