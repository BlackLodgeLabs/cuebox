"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { FilmStatus } from "@/types/api";

interface FilmStatusActionsProps {
  status: FilmStatus;
  variant?: "table" | "detail";
  onTransition: (status: FilmStatus) => void;
  onMarkWatched?: () => void;
  onCompleteReview?: () => void;
  isPending?: boolean;
}

export function FilmStatusActions({
  status,
  variant = "table",
  onTransition,
  onMarkWatched,
  onCompleteReview,
  isPending = false,
}: FilmStatusActionsProps) {
  const [archiveOpen, setArchiveOpen] = useState(false);

  const renderButton = (label: string, onClick: () => void) => {
    if (variant === "table") {
      return (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-label-md"
          aria-label={label}
          title={label}
          onClick={onClick}
          disabled={isPending}
        >
          {label}
        </Button>
      );
    }

    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onClick}
        disabled={isPending}
      >
        {label}
      </Button>
    );
  };

  let actions: React.ReactNode = null;

  if (status === "active") {
    actions = (
      <>
        {renderButton("Mark watched", () => {
          if (onMarkWatched) {
            onMarkWatched();
          } else {
            onTransition("pending_watch_review");
          }
        })}
        {renderButton("Archive", () => setArchiveOpen(true))}
      </>
    );
  } else if (status === "pending_watch_review") {
    actions = renderButton("Complete review", () => {
      if (onCompleteReview) {
        onCompleteReview();
      }
    });
  } else if (status === "watched") {
    actions = renderButton("Return to watchlist", () => onTransition("active"));
  } else if (status === "archived") {
    actions = renderButton("Re-enable on watchlist", () => onTransition("active"));
  }

  if (actions === null) {
    return null;
  }

  return (
    <>
      <div
        className={
          variant === "table"
            ? "flex items-center justify-end gap-1"
            : "flex flex-wrap gap-2"
        }
      >
        {actions}
      </div>
      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive film</DialogTitle>
            <DialogDescription>
              This removes the film from your active watchlist and moves it to
              Archived. You can restore it later from the Archived tab.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setArchiveOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                onTransition("archived");
                setArchiveOpen(false);
              }}
              disabled={isPending}
            >
              {isPending ? "Archiving…" : "Archive"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
