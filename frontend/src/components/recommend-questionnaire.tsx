"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { scrollFieldIntoView } from "@/lib/scroll-field-into-view";
import {
  EMOTIONAL_OUTCOMES,
  ERA_OPTIONS,
  GENRE_HIERARCHY,
  NO_PREFERENCE,
  OBSCURITY_OPTIONS,
  PACING_OPTIONS,
  RUNTIME_OPTIONS,
  SUBTITLE_OPTIONS,
  THINKING_EFFORT_OPTIONS,
  VIEWING_CONTEXT_OPTIONS,
  VISUAL_TONAL_VIBES,
  type GenreNode,
} from "@/lib/questionnaire-vocabulary";
import { cn } from "@/lib/utils";
import type { Questionnaire } from "@/types/api";

export const QUESTION_COUNT = 11;

export const QUESTION_STEPS = [
  {
    id: "genres",
    question: "What genres are you in the mood for?",
    kind: "genres",
  },
  {
    id: "runtime",
    question: "How long do you want the film to be?",
    kind: "cards",
  },
  {
    id: "viewing_context",
    question: "Who are you watching with?",
    kind: "cards",
  },
  {
    id: "thinking_effort",
    question: "How much do you want to think?",
    kind: "cards",
  },
  {
    id: "pacing",
    question: "What pace are you in the mood for?",
    kind: "cards",
  },
  {
    id: "emotional_outcomes",
    question: "How do you want to feel?",
    kind: "chips",
  },
  {
    id: "visual_tonal_vibes",
    question: "What look and feel are you after?",
    kind: "chips",
  },
  {
    id: "era",
    question: "When should it be from?",
    kind: "cards",
  },
  {
    id: "subtitle_preference",
    question: "Are subtitles okay?",
    kind: "cards",
  },
  {
    id: "obscurity_preference",
    question: "How well-known should it be?",
    kind: "cards",
  },
  {
    id: "notes",
    question: "Anything else we should know?",
    kind: "notes",
  },
] as const;

export type QuestionStepId = (typeof QUESTION_STEPS)[number]["id"];

export function choiceClass(selected: boolean, size: "chip" | "card"): string {
  return cn(
    "border font-ui font-medium",
    size === "chip"
      ? "inline-flex min-h-11 items-center rounded-cb px-3.5 text-cb-caption"
      : "flex min-h-[72px] w-full items-center justify-between rounded-cb px-4 text-left text-base",
    selected
      ? "border-cb-teal bg-[rgba(42,154,148,0.14)] text-cb-teal"
      : "border-cb-divider bg-cb-surface text-cb-text",
  );
}

function Check() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12.5 9.2 17 19 7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function RecommendQuestionnaire({
  stepIndex,
  questionnaire,
  notes,
  stepError,
  submitError,
  submitting,
  onToggle,
  onSelect,
  onNotes,
  onClose,
  onBack,
  onSkip,
  onNext,
  onRetry,
}: {
  stepIndex: number;
  questionnaire: Questionnaire;
  notes: string;
  stepError: string | null;
  submitError: string | null;
  submitting: boolean;
  onToggle: (field: "genres" | "emotional_outcomes" | "visual_tonal_vibes", value: string) => void;
  onSelect: (field: Exclude<QuestionStepId, "genres" | "emotional_outcomes" | "visual_tonal_vibes" | "notes">, value: string) => void;
  onNotes: (value: string) => void;
  onClose: () => void;
  onBack: () => void;
  onSkip: () => void;
  onNext: () => void;
  onRetry: () => void;
}) {
  const step = QUESTION_STEPS[stepIndex];
  const isNotes = step.kind === "notes";
  const progress = ((stepIndex + 1) / QUESTION_COUNT) * 100;

  return (
    <div
      className="flex h-[calc(100dvh-1.5rem)] flex-col"
      data-testid="questionnaire-content"
      data-step={step.id}
    >
      <header className="flex h-11 items-center justify-between">
        <button
          type="button"
          aria-label={stepIndex === 0 ? "Close" : "Back"}
          className="flex h-11 w-11 items-center justify-center text-cb-text"
          onClick={stepIndex === 0 ? onClose : onBack}
        >
          {stepIndex === 0 ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M15 5 8 12l7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
        <p className="font-mono text-xs tracking-[0.04em] text-cb-muted">
          {stepIndex + 1} of {QUESTION_COUNT}
        </p>
        {isNotes ? (
          <span className="w-11" />
        ) : (
          <button
            type="button"
            className="h-11 px-2 font-ui text-sm font-medium text-cb-teal"
            onClick={onSkip}
          >
            Skip
          </button>
        )}
      </header>
      <div
        role="progressbar"
        aria-valuenow={stepIndex + 1}
        aria-valuemin={1}
        aria-valuemax={QUESTION_COUNT}
        aria-label={`Question ${stepIndex + 1} of ${QUESTION_COUNT}`}
        className="mb-2 h-0.5 overflow-hidden rounded-sm bg-cb-divider"
      >
        <div className="h-full bg-cb-teal" style={{ width: `${progress}%` }} />
      </div>

      <div data-testid="questionnaire-scroll" className="min-h-0 flex-1 overflow-y-auto pb-4 pt-4">
        <h1 className="mb-5 font-display text-[32px] font-bold leading-9 tracking-[-0.01em]">
          {step.question}
        </h1>
        <StepBody
          stepId={step.id}
          kind={step.kind}
          questionnaire={questionnaire}
          notes={notes}
          onToggle={onToggle}
          onSelect={onSelect}
          onNotes={onNotes}
        />
      </div>

      {stepError ? (
        <p className="pt-3 font-ui text-sm text-cb-danger" role="alert">
          {stepError}
        </p>
      ) : null}
      {submitError ? (
        <div role="alert" className="space-y-3 pt-3">
          <p className="font-ui text-sm text-cb-danger">{submitError}</p>
          <Button type="button" variant="secondary" className="h-11 w-full" onClick={onRetry}>
            Try again
          </Button>
        </div>
      ) : null}

      <div
        data-testid="questionnaire-sticky-chrome"
        className="shrink-0 border-t border-cb-divider bg-cb-bg py-3"
      >
        {isNotes ? (
          <Button
            type="button"
            className="h-11 w-full"
            onClick={onNext}
            disabled={submitting}
          >
            Find my pick
          </Button>
        ) : (
          <Button
            type="button"
            variant="secondary"
            className="h-11 w-full font-semibold shadow-none"
            onClick={onNext}
            disabled={submitting}
          >
            Next
          </Button>
        )}
      </div>
    </div>
  );
}

function StepBody({
  stepId,
  kind,
  questionnaire,
  notes,
  onToggle,
  onSelect,
  onNotes,
}: {
  stepId: QuestionStepId;
  kind: (typeof QUESTION_STEPS)[number]["kind"];
  questionnaire: Questionnaire;
  notes: string;
  onToggle: (field: "genres" | "emotional_outcomes" | "visual_tonal_vibes", value: string) => void;
  onSelect: (field: Exclude<QuestionStepId, "genres" | "emotional_outcomes" | "visual_tonal_vibes" | "notes">, value: string) => void;
  onNotes: (value: string) => void;
}) {
  if (kind === "genres") {
    return (
      <div className="space-y-4">
        <Chip
          label={NO_PREFERENCE}
          selected={questionnaire.genres.includes(NO_PREFERENCE)}
          onClick={() => onToggle("genres", NO_PREFERENCE)}
        />
        {GENRE_HIERARCHY.map((group) => (
          <GenreGroup
            key={group.label}
            group={group}
            selected={questionnaire.genres}
            onToggle={(label) => onToggle("genres", label)}
          />
        ))}
      </div>
    );
  }

  if (kind === "chips" && (stepId === "emotional_outcomes" || stepId === "visual_tonal_vibes")) {
    const options = stepId === "emotional_outcomes" ? EMOTIONAL_OUTCOMES : VISUAL_TONAL_VIBES;
    const value = questionnaire[stepId];
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {options.map((option) => (
            <Chip
              key={option}
              label={option}
              selected={value.includes(option)}
              onClick={() => onToggle(stepId, option)}
            />
          ))}
        </div>
      </div>
    );
  }

  if (kind === "notes") {
    return (
      <div className="flex flex-col">
        <p className="-mt-3 mb-4 font-mono text-[11px] uppercase tracking-[0.06em] text-cb-muted">
          Optional
        </p>
        <Textarea
          value={notes}
          onChange={(event) => onNotes(event.target.value)}
          onFocus={(event) => scrollFieldIntoView(event.currentTarget)}
          maxLength={1000}
          rows={8}
          placeholder="Slow, unsettling, under two hours."
          data-testid="questionnaire-notes"
          className="min-h-[200px] flex-1 resize-none border-cb-divider bg-cb-surface font-ui text-[15px] leading-[22px] text-cb-text placeholder:text-cb-muted"
        />
        <p className="mt-2 text-right font-mono text-[11px] text-cb-muted">{notes.length}/1000</p>
      </div>
    );
  }

  const options = cardOptions(stepId);
  const value = questionnaire[stepId as keyof Questionnaire];
  return (
    <div>
      <div className="flex flex-col gap-2">
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              className={choiceClass(selected, "card")}
              onClick={() =>
                onSelect(
                  stepId as Exclude<QuestionStepId, "genres" | "emotional_outcomes" | "visual_tonal_vibes" | "notes">,
                  option.value,
                )
              }
            >
              <span>{option.label}</span>
              {selected ? <Check /> : null}
            </button>
          );
        })}
      </div>
      <p className="mt-4 font-ui text-[13px] text-cb-muted">Pick one to continue</p>
    </div>
  );
}

function Chip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={choiceClass(selected, "chip")}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function GenreGroup({
  group,
  selected,
  onToggle,
}: {
  group: GenreNode;
  selected: string[];
  onToggle: (label: string) => void;
}) {
  const labels = [group.label, ...(group.children?.map((child) => child.label) ?? [])];
  return (
    <div>
      <p className="mb-2 font-ui text-[13px] font-semibold text-cb-muted">{group.label}</p>
      <div className="flex flex-wrap gap-2">
        {labels.map((label) => (
          <Chip
            key={label}
            label={label}
            selected={selected.includes(label)}
            onClick={() => onToggle(label)}
          />
        ))}
      </div>
    </div>
  );
}

function cardOptions(stepId: QuestionStepId): { value: string; label: string }[] {
  switch (stepId) {
    case "runtime":
      return RUNTIME_OPTIONS;
    case "viewing_context":
      return VIEWING_CONTEXT_OPTIONS;
    case "thinking_effort":
      return THINKING_EFFORT_OPTIONS;
    case "pacing":
      return PACING_OPTIONS;
    case "era":
      return ERA_OPTIONS;
    case "subtitle_preference":
      return SUBTITLE_OPTIONS;
    case "obscurity_preference":
      return OBSCURITY_OPTIONS;
    default:
      return [];
  }
}
