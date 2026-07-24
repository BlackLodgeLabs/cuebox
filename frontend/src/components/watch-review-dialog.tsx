"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { HalfStarRatingInput } from "@/components/half-star-rating-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useCancelWatchReview,
  useCompleteWatchReview,
  useUpdateFilmWatch,
} from "@/hooks/use-films";
import { useToast } from "@/hooks/use-toast";
import type { FilmWatch } from "@/types/api";

interface WatchReviewDialogProps {
  filmId: string;
  filmTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: "complete" | "edit";
  /** When true, dismiss/Cancel reverts pending_watch_review to active (manual mark-watched only). */
  cancelOnDismiss?: boolean;
  /** Called after a successful complete/edit save (before dialog closes). */
  onCompleted?: () => void;
  watchId?: string;
  initialScore?: number | null;
  initialWatchedAt?: string;
  initialNotes?: string | null;
}

function todayIsoDate(): string {
  return new Date().toISOString().split("T")[0];
}

export function WatchReviewDialog({
  filmId,
  filmTitle,
  open,
  onOpenChange,
  mode = "complete",
  cancelOnDismiss = false,
  onCompleted,
  watchId,
  initialScore = null,
  initialWatchedAt,
  initialNotes = "",
}: WatchReviewDialogProps) {
  const { toast } = useToast();
  const complete = useCompleteWatchReview();
  const cancel = useCancelWatchReview();
  const update = useUpdateFilmWatch();

  const [score, setScore] = useState<number | null>(initialScore);
  const [watchedAt, setWatchedAt] = useState(initialWatchedAt ?? todayIsoDate());
  const [notes, setNotes] = useState(initialNotes ?? "");
  const saveInFlightRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    setScore(initialScore);
    setWatchedAt(initialWatchedAt ?? todayIsoDate());
    setNotes(initialNotes ?? "");
  }, [open, initialScore, initialWatchedAt, initialNotes]);

  const isValid = useMemo(() => {
    if (score === null || score < 0.5) return false;
    if (!watchedAt) return false;
    if (watchedAt > todayIsoDate()) return false;
    return true;
  }, [score, watchedAt]);

  const isPending = complete.isPending || cancel.isPending || update.isPending;

  const handleSave = async () => {
    if (!isValid || score === null || saveInFlightRef.current) return;

    saveInFlightRef.current = true;
    try {
      if (mode === "edit" && watchId) {
        await update.mutateAsync({
          filmId,
          watchId,
          body: { score, watched_at: watchedAt, notes: notes || undefined },
        });
        toast({ title: "Watch record updated" });
      } else {
        await complete.mutateAsync({
          filmId,
          body: { score, watched_at: watchedAt, notes: notes || undefined },
        });
        toast({ title: "Watch review saved", description: `${filmTitle} marked as watched.` });
      }
      onCompleted?.();
      onOpenChange(false);
    } catch {
      // toast handled by mutation hook
    } finally {
      saveInFlightRef.current = false;
    }
  };

  const handleCancel = async () => {
    if (mode === "edit" || !cancelOnDismiss) {
      onOpenChange(false);
      return;
    }

    try {
      await cancel.mutateAsync(filmId);
      onOpenChange(false);
    } catch {
      // toast handled by mutation hook
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && open) {
      if (saveInFlightRef.current || complete.isPending || update.isPending) {
        return;
      }
      if (mode === "complete" && cancelOnDismiss) {
        void handleCancel();
        return;
      }
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Edit watch record" : "Review watched film"}
          </DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? `Update your diary entry for ${filmTitle}.`
              : `Record how you watched ${filmTitle}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="watch-score">Score</Label>
            <HalfStarRatingInput
              id="watch-score"
              value={score}
              onChange={setScore}
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="watched-at">Watched date</Label>
            <Input
              id="watched-at"
              type="date"
              max={todayIsoDate()}
              value={watchedAt}
              onChange={(event) => setWatchedAt(event.target.value)}
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="watch-notes">Notes (optional)</Label>
            <textarea
              id="watch-notes"
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              disabled={isPending}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleCancel()}
            disabled={isPending}
            aria-label={cancelOnDismiss ? "Cancel watch review" : "Close watch review"}
          >
            {cancelOnDismiss ? "Cancel" : "Close"}
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={!isValid || isPending}
          >
            {isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function watchToDialogProps(watch: FilmWatch) {
  const score = watch.score;
  return {
    watchId: watch.id,
    initialScore:
      score == null || (watch.is_pending && score <= 0.5) ? null : score,
    initialWatchedAt: watch.watched_at,
    initialNotes: watch.notes,
  };
}
