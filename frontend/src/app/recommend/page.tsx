"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MultiSelectChips } from "@/components/multi-select-chips";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useCreateRecommendation } from "@/hooks/use-recommendations";
import { ApiClientError } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/error-messages";
import {
  ALL_GENRE_LABELS,
  DEFAULT_QUESTIONNAIRE,
  EMOTIONAL_OUTCOMES,
  ERA_OPTIONS,
  hasNoPreferenceConflict,
  OBSCURITY_OPTIONS,
  PACING_OPTIONS,
  RUNTIME_OPTIONS,
  SUBTITLE_OPTIONS,
  THINKING_EFFORT_OPTIONS,
  VIEWING_CONTEXT_OPTIONS,
  VISUAL_TONAL_VIBES,
} from "@/lib/questionnaire-vocabulary";
import type { Questionnaire } from "@/types/api";

const STEPS = [
  { id: "genres", title: "Genres", description: "What genres are you in the mood for?" },
  { id: "runtime", title: "Runtime", description: "How long do you want the film to be?" },
  { id: "viewing_context", title: "Viewing context", description: "Who are you watching with?" },
  { id: "thinking_effort", title: "Thinking effort", description: "How much mental energy do you want to spend?" },
  { id: "pacing", title: "Pacing", description: "What pacing do you prefer?" },
  { id: "emotional_outcomes", title: "Emotional outcomes", description: "How do you want to feel afterward?" },
  { id: "visual_tonal_vibes", title: "Visual & tonal vibes", description: "What look and feel are you after?" },
  { id: "era", title: "Era", description: "When was the film made?" },
  { id: "subtitle_preference", title: "Subtitles", description: "Are subtitles OK?" },
  { id: "obscurity_preference", title: "Obscurity", description: "How well-known should the film be?" },
  { id: "notes", title: "Notes", description: "Anything else we should know? (optional)" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

export default function RecommendPage() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [questionnaire, setQuestionnaire] = useState<Questionnaire>({
    ...DEFAULT_QUESTIONNAIRE,
  });
  const [notes, setNotes] = useState("");
  const [stepError, setStepError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isNavigatingToResults, setIsNavigatingToResults] = useState(false);
  const submittingRef = useRef(false);
  const create = useCreateRecommendation();

  const isSubmitting = create.isPending || isNavigatingToResults;

  const step = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;
  const isNotesStep = step.id === "notes";

  const validateStep = (): boolean => {
    setStepError(null);
    const id = step.id;

    if (id === "genres" && questionnaire.genres.length === 0) {
      setStepError("Select at least one genre or No Preference.");
      return false;
    }
    if (id === "genres" && hasNoPreferenceConflict(questionnaire.genres)) {
      setStepError('"No Preference" cannot be combined with other genres.');
      return false;
    }
    if (id === "emotional_outcomes" && questionnaire.emotional_outcomes.length === 0) {
      setStepError("Select at least one emotional outcome or No Preference.");
      return false;
    }
    if (id === "emotional_outcomes" && hasNoPreferenceConflict(questionnaire.emotional_outcomes)) {
      setStepError('"No Preference" cannot be combined with other selections.');
      return false;
    }
    if (id === "visual_tonal_vibes" && questionnaire.visual_tonal_vibes.length === 0) {
      setStepError("Select at least one vibe or No Preference.");
      return false;
    }
    if (id === "visual_tonal_vibes" && hasNoPreferenceConflict(questionnaire.visual_tonal_vibes)) {
      setStepError('"No Preference" cannot be combined with other selections.');
      return false;
    }
    if (isNotesStep && notes.length > 1000) {
      setStepError("Notes must be 1000 characters or fewer.");
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    if (isLastStep) {
      if (submittingRef.current || isSubmitting) return;
      void handleSubmit();
      return;
    }
    setStepIndex((i) => i + 1);
  };

  const handleSubmit = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitError(null);
    setIsNavigatingToResults(true);
    try {
      const result = await create.mutateAsync({
        questionnaire,
        notes: notes.trim() || undefined,
      });
      router.push(`/recommend/results/${result.session_id}`);
    } catch (error) {
      setIsNavigatingToResults(false);
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
        setSubmitError("Recommendation failed. Please try again.");
      }
    }
  };

  if (isSubmitting) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-16 text-center">
        <h1 className="text-h1">Finding your film…</h1>
        <p className="text-body-md text-muted-foreground">
          This can take up to 30 seconds while we search and rank your
          watchlist.
        </p>
        <div className="mx-auto h-2 w-48 animate-pulse rounded-full bg-muted" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <p className="text-label-md normal-case tracking-normal text-secondary">
          Step {stepIndex + 1} of {STEPS.length}
        </p>
        <h1 className="text-h1">{step.title}</h1>
        <p className="mt-1 text-body-md text-muted-foreground">{step.description}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{step.title}</CardTitle>
          <CardDescription>{step.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <StepContent
            stepId={step.id}
            questionnaire={questionnaire}
            setQuestionnaire={setQuestionnaire}
            notes={notes}
            setNotes={setNotes}
            error={stepError}
          />
          {submitError && (
            <p className="text-sm text-destructive">{submitError}</p>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button
          variant="outline"
          disabled={stepIndex === 0 || isSubmitting}
          onClick={() => setStepIndex((i) => i - 1)}
        >
          Back
        </Button>
        <Button onClick={handleNext} disabled={isSubmitting}>
          {isLastStep ? "Get recommendation" : "Next"}
        </Button>
      </div>
    </div>
  );
}

function StepContent({
  stepId,
  questionnaire,
  setQuestionnaire,
  notes,
  setNotes,
  error,
}: {
  stepId: StepId;
  questionnaire: Questionnaire;
  setQuestionnaire: React.Dispatch<React.SetStateAction<Questionnaire>>;
  notes: string;
  setNotes: (v: string) => void;
  error: string | null;
}) {
  switch (stepId) {
    case "genres":
      return (
        <MultiSelectChips
          options={["No Preference", ...ALL_GENRE_LABELS]}
          value={questionnaire.genres}
          onChange={(genres) =>
            setQuestionnaire((q) => ({ ...q, genres }))
          }
          error={error ?? undefined}
        />
      );
    case "runtime":
      return (
        <RadioOptions
          value={questionnaire.runtime}
          options={RUNTIME_OPTIONS}
          onChange={(runtime) =>
            setQuestionnaire((q) => ({ ...q, runtime }))
          }
        />
      );
    case "viewing_context":
      return (
        <RadioOptions
          value={questionnaire.viewing_context}
          options={VIEWING_CONTEXT_OPTIONS}
          onChange={(viewing_context) =>
            setQuestionnaire((q) => ({ ...q, viewing_context }))
          }
        />
      );
    case "thinking_effort":
      return (
        <RadioOptions
          value={questionnaire.thinking_effort}
          options={THINKING_EFFORT_OPTIONS}
          onChange={(thinking_effort) =>
            setQuestionnaire((q) => ({ ...q, thinking_effort }))
          }
        />
      );
    case "pacing":
      return (
        <RadioOptions
          value={questionnaire.pacing}
          options={PACING_OPTIONS}
          onChange={(pacing) => setQuestionnaire((q) => ({ ...q, pacing }))}
        />
      );
    case "emotional_outcomes":
      return (
        <MultiSelectChips
          options={EMOTIONAL_OUTCOMES}
          value={questionnaire.emotional_outcomes}
          onChange={(emotional_outcomes) =>
            setQuestionnaire((q) => ({ ...q, emotional_outcomes }))
          }
          error={error ?? undefined}
        />
      );
    case "visual_tonal_vibes":
      return (
        <MultiSelectChips
          options={VISUAL_TONAL_VIBES}
          value={questionnaire.visual_tonal_vibes}
          onChange={(visual_tonal_vibes) =>
            setQuestionnaire((q) => ({ ...q, visual_tonal_vibes }))
          }
          error={error ?? undefined}
        />
      );
    case "era":
      return (
        <RadioOptions
          value={questionnaire.era}
          options={ERA_OPTIONS}
          onChange={(era) => setQuestionnaire((q) => ({ ...q, era }))}
        />
      );
    case "subtitle_preference":
      return (
        <RadioOptions
          value={questionnaire.subtitle_preference}
          options={SUBTITLE_OPTIONS}
          onChange={(subtitle_preference) =>
            setQuestionnaire((q) => ({ ...q, subtitle_preference }))
          }
        />
      );
    case "obscurity_preference":
      return (
        <RadioOptions
          value={questionnaire.obscurity_preference}
          options={OBSCURITY_OPTIONS}
          onChange={(obscurity_preference) =>
            setQuestionnaire((q) => ({ ...q, obscurity_preference }))
          }
        />
      );
    case "notes":
      return (
        <div className="space-y-2">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={1000}
            rows={5}
            placeholder="e.g. I've been enjoying slow-burn atmospheric horror lately."
          />
          <p className="text-right text-xs text-muted-foreground">
            {notes.length}/1000
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      );
    default:
      return null;
  }
}

function RadioOptions<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <RadioGroup value={value} onValueChange={(v) => onChange(v as T)}>
      {options.map((opt) => (
        <div key={opt.value} className="flex items-center space-x-2">
          <RadioGroupItem value={opt.value} id={opt.value} />
          <Label htmlFor={opt.value} className="cursor-pointer font-normal">
            {opt.label}
          </Label>
        </div>
      ))}
    </RadioGroup>
  );
}
