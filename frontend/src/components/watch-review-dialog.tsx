"use client";

import { useEffect, useRef, useState } from "react";
import { HalfStarRatingInput } from "@/components/half-star-rating-input";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CueNumber } from "@/components/ui/cue-number";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import {
  useCreateFilmWatch,
  useDeleteFilmWatch,
  useUpdateFilmWatch,
} from "@/hooks/use-films";
import { starFillMotion } from "@/lib/motion";
import { filmMetaLine } from "@/lib/programme-format";
import { cn } from "@/lib/utils";
import type { FilmDetail, FilmWatch } from "@/types/api";

/** Letterboxd stores an unknown day as this sentinel. Manual watches must not send it. */
export const UNKNOWN_WATCH_DATE = "1984-09-28";

interface WatchReviewDialogProps {
  filmId: string;
  filmTitle: string;
  year?: number | null;
  genre?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: "create" | "edit";
  onCompleted?: () => void;
  watchId?: string;
  initialScore?: number | null;
  initialWatchedAt?: string | null;
  initialNotes?: string | null;
}

function todayIsoDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function editableDate(value: string | null | undefined): string {
  if (!value || value === UNKNOWN_WATCH_DATE) return "";
  return value;
}

function formatIsoDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function pickCreatedWatch(detail: FilmDetail, score: number): FilmWatch | undefined {
  const matches = (detail.watches ?? []).filter(
    (watch) => !watch.is_pending && watch.score === score,
  );
  return matches.sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
}

function revealDelayMs(
  score: number,
  spec: ReturnType<typeof starFillMotion>,
): number {
  if (spec.travel === "none") return 0;
  const last = Math.max(0, Math.ceil(score) - 1);
  return last * spec.staggerMs + spec.fillMs + spec.bounceMs + spec.savedDelayMs;
}

export function WatchReviewDialog({
  filmId,
  filmTitle,
  year = null,
  genre = null,
  open,
  onOpenChange,
  mode = "create",
  onCompleted,
  watchId: watchIdProp,
  initialScore = null,
  initialWatchedAt = null,
  initialNotes = "",
}: WatchReviewDialogProps) {
  const reduced = useReducedMotion();
  const spec = starFillMotion(mode === "edit" ? true : reduced);
  const create = useCreateFilmWatch();
  const update = useUpdateFilmWatch();
  const remove = useDeleteFilmWatch();
  const dateRef = useRef<HTMLInputElement>(null);
  const savedNoteRef = useRef("");

  const [score, setScore] = useState<number | null>(null);
  const [watchedAt, setWatchedAt] = useState("");
  const [notes, setNotes] = useState("");
  const [watchId, setWatchId] = useState<string | undefined>();
  const [revealed, setRevealed] = useState(false);
  const [shown, setShown] = useState(false);
  const [creating, setCreating] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const editing = mode === "edit";
    setScore(editing ? initialScore : null);
    setWatchedAt(editing ? editableDate(initialWatchedAt) : "");
    setNotes(editing ? (initialNotes ?? "") : "");
    setWatchId(editing ? watchIdProp : undefined);
    setRevealed(editing);
    setShown(editing);
    setCreating(false);
    setConfirmOpen(false);
    savedNoteRef.current = editing ? (initialNotes ?? "").trim() : "";
  }, [open, mode, filmId, watchIdProp, initialScore, initialWatchedAt, initialNotes]);

  useEffect(() => {
    if (!revealed || mode === "edit") return;
    const frame = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(frame);
  }, [revealed, mode]);

  const meta = filmMetaLine([
    year ? String(year) : null,
    genre?.trim() || null,
  ]);
  const today = todayIsoDate();
  const delay = score == null ? 0 : revealDelayMs(score, mode === "create" ? starFillMotion(reduced) : spec);
  const createSpec = starFillMotion(reduced);
  const fadeMs = mode === "create" && reduced ? createSpec.crossfadeMs : createSpec.savedFadeMs;
  const fadeDelay = mode === "create" && !reduced ? delay : 0;
  const ease = "cubic-bezier(0.16, 1, 0.3, 1)";
  const fade = reduced
    ? `opacity ${createSpec.crossfadeMs}ms linear`
    : `opacity ${fadeMs}ms ${ease} ${fadeDelay}ms, transform ${fadeMs}ms ${ease} ${fadeDelay}ms`;

  async function chooseScore(next: number) {
    if (creating || next === score) return;
    if (mode === "edit") {
      setScore(next);
      return;
    }
    if (!watchId) {
      setCreating(true);
      setScore(next);
      setRevealed(true);
      try {
        const detail = await create.mutateAsync({ filmId, body: { score: next } });
        const created = pickCreatedWatch(detail, next);
        if (!created) {
          setRevealed(false);
          setShown(false);
          setScore(null);
          return;
        }
        setWatchId(created.id);
      } catch {
        setRevealed(false);
        setShown(false);
        setScore(null);
      } finally {
        setCreating(false);
      }
      return;
    }
    setScore(next);
    try {
      await update.mutateAsync({ filmId, watchId, body: { score: next } });
    } catch {
      // The hook toasts. Keep the star the user tapped.
    }
  }

  function openDatePicker() {
    const input = dateRef.current;
    if (!input) return;
    try {
      input.showPicker();
    } catch {
      input.focus();
    }
  }

  function commitDate(next: string) {
    if (next === UNKNOWN_WATCH_DATE || next === watchedAt) return;
    setWatchedAt(next);
    if (mode === "edit" || !watchId) return;
    void update.mutateAsync({
      filmId,
      watchId,
      body: { watched_at: next || null },
    });
  }

  function commitNote() {
    if (mode === "edit" || !watchId) return;
    const next = notes.trim();
    if (next === savedNoteRef.current) return;
    savedNoteRef.current = next;
    void update.mutateAsync({
      filmId,
      watchId,
      body: { notes: next || null },
    });
  }

  async function saveChanges() {
    if (mode !== "edit" || !watchId || score == null) return;
    try {
      await update.mutateAsync({
        filmId,
        watchId,
        body: {
          score,
          watched_at: watchedAt || null,
          notes: notes.trim() || null,
        },
      });
      onCompleted?.();
      onOpenChange(false);
    } catch {
      // The hook toasts.
    }
  }

  async function confirmDelete() {
    if (!watchId) return;
    try {
      await remove.mutateAsync({ filmId, watchId });
      setConfirmOpen(false);
      onCompleted?.();
      onOpenChange(false);
    } catch {
      // The hook toasts. The film status is unchanged.
    }
  }

  const inputsReady = mode === "edit" || Boolean(watchId);
  const dateLabel = watchedAt ? `Watched date ${formatIsoDate(watchedAt)}` : "Add a date";

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          aria-label={`Review ${filmTitle}`}
          data-mode={mode}
          className="gap-0 px-4 pb-6 pt-0"
        >
          <SheetHeader className="space-y-1 text-left">
            <p
              className="font-mono text-[11px] uppercase tracking-[0.06em] text-cb-muted"
              aria-hidden={mode === "create" && shown ? true : undefined}
              style={
                mode === "create"
                  ? {
                      opacity: shown ? 0 : 1,
                      maxHeight: shown ? 0 : 20,
                      overflow: "hidden",
                      transition: fade,
                    }
                  : undefined
              }
            >
              {mode === "edit" ? "Edit review" : "How was it?"}
            </p>
            <SheetTitle className="text-[26px] leading-7">{filmTitle}</SheetTitle>
            {meta ? (
              <p className="font-mono text-[12px] leading-4 text-cb-muted">{meta}</p>
            ) : null}
            <SheetDescription className="sr-only">
              {mode === "edit"
                ? "Change the rating, date, or note, then save."
                : "Tap a star to save this watch. Date and note are optional."}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-5">
            <HalfStarRatingInput
              value={score}
              onChange={(next) => void chooseScore(next)}
              disabled={creating}
              animate={mode === "create"}
            />
          </div>

          {mode === "create" ? (
            <p
              className="text-center font-ui text-cb-ui text-cb-muted"
              aria-hidden={shown ? true : undefined}
              style={{
                opacity: shown ? 0 : 1,
                maxHeight: shown ? 0 : 40,
                marginTop: shown ? 0 : 8,
                marginBottom: shown ? 0 : 4,
                overflow: "hidden",
                transition: fade,
              }}
            >
              Tap a star to save
            </p>
          ) : null}

          {mode === "edit" || revealed ? (
            <div
              data-cb-saved=""
              data-saved-delay-ms={createSpec.savedDelayMs}
              data-saved-fade-ms={mode === "create" ? createSpec.savedFadeMs : 0}
              data-reveal-ms={mode === "create" && score != null ? revealDelayMs(score, createSpec) : 0}
              style={
                mode === "create"
                  ? {
                      opacity: shown ? 1 : 0,
                      transform: reduced ? undefined : shown ? "translateY(0)" : "translateY(10px)",
                      transition: fade,
                    }
                  : undefined
              }
            >
              {score != null ? (
                <p className="mt-2 text-center font-display text-[22px] font-bold leading-none text-cb-text">
                  <CueNumber value={score} />
                </p>
              ) : null}
              {mode === "create" ? (
                <p className="mt-2 flex items-center justify-center gap-1.5 font-ui text-[13px] font-medium text-cb-teal">
                  <Icon name="check" size={16} />
                  <span>Saved</span>
                </p>
              ) : null}

              <div className={cn("flex flex-col gap-3", mode === "create" ? "mt-5" : "mt-4")}>
                <div className="flex min-h-11 w-full items-center gap-2.5 rounded-cb border border-cb-divider bg-cb-surface px-3 font-ui text-cb-ui">
                  <button
                    type="button"
                    aria-label={dateLabel}
                    disabled={!inputsReady}
                    onClick={openDatePicker}
                    className="flex min-h-11 flex-1 items-center gap-2.5 text-left disabled:opacity-50"
                  >
                    <Icon name="calendar_today" size={18} className="text-cb-muted" />
                    <span className={watchedAt ? "text-cb-text" : "text-cb-muted"}>
                      {watchedAt ? formatIsoDate(watchedAt) : "Add a date"}
                    </span>
                  </button>
                  {watchedAt ? (
                    <button
                      type="button"
                      aria-label="Clear date"
                      disabled={!inputsReady}
                      className="flex h-7 w-7 items-center justify-center text-cb-muted"
                      onClick={() => commitDate("")}
                    >
                      <Icon name="close" size={16} />
                    </button>
                  ) : null}
                </div>
                <input
                  ref={dateRef}
                  type="date"
                  aria-label="Watched date"
                  max={today}
                  value={watchedAt}
                  onChange={(event) => commitDate(event.target.value)}
                  className="sr-only"
                  tabIndex={-1}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={!inputsReady}
                    onClick={() => commitDate(today)}
                    className={cn(
                      "inline-flex min-h-9 items-center rounded-cb border px-3.5 font-ui text-[13px] font-medium",
                      watchedAt === today
                        ? "border-cb-teal text-cb-teal"
                        : "border-cb-divider text-cb-text",
                    )}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    disabled={!inputsReady}
                    onClick={openDatePicker}
                    className="inline-flex min-h-9 items-center rounded-cb border border-cb-divider px-3.5 font-ui text-[13px] font-medium text-cb-text"
                  >
                    Pick a date
                  </button>
                </div>
                <textarea
                  aria-label="Write a note"
                  placeholder="Write a note"
                  value={notes}
                  disabled={!inputsReady}
                  onChange={(event) => setNotes(event.target.value)}
                  onBlur={commitNote}
                  className="min-h-[88px] w-full resize-none rounded-cb border border-cb-divider bg-cb-surface px-3 py-3 font-ui text-cb-ui text-cb-text placeholder:text-cb-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cb-accent disabled:opacity-50"
                />
              </div>
            </div>
          ) : null}

          {mode === "edit" ? (
            <div className="mt-4">
              <Button
                type="button"
                className="h-11 w-full"
                disabled={score == null || update.isPending}
                onClick={() => void saveChanges()}
              >
                Save changes
              </Button>
              <button
                type="button"
                className="mt-2 flex h-11 w-full items-center justify-center font-ui text-cb-ui font-medium text-cb-danger"
                onClick={() => setConfirmOpen(true)}
              >
                Delete this watch
              </button>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete this watch?"
        description="This viewing and its rating will be removed from your history. The film will stay marked as watched."
        confirmLabel="Delete"
        pending={remove.isPending}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}

export function watchToDialogProps(watch: FilmWatch) {
  const score = watch.score;
  return {
    watchId: watch.id,
    initialScore: score == null || (watch.is_pending && score <= 0.5) ? null : score,
    initialWatchedAt: watch.watched_at,
    initialNotes: watch.notes,
  };
}
