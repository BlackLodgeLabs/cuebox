"use client";

import { useState } from "react";
import { Archive, Eye, RotateCcw } from "lucide-react";
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
  isPending?: boolean;
}

export function FilmStatusActions({
  status,
  variant = "table",
  onTransition,
  isPending = false,
}: FilmStatusActionsProps) {
  const [archiveOpen, setArchiveOpen] = useState(false);

  const renderButton = (
    label: string,
    icon: React.ReactNode,
    onClick: () => void,
  ) => {
    if (variant === "table") {
      return (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label={label}
          title={label}
          onClick={onClick}
          disabled={isPending}
        >
          {icon}
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
        {icon}
        <span className="ml-2">{label}</span>
      </Button>
    );
  };

  let actions: React.ReactNode = null;

  if (status === "active") {
    actions = (
      <>
        {renderButton(
          "Mark watched",
          <Eye className="h-4 w-4" />,
          () => onTransition("watched"),
        )}
        {renderButton(
          "Archive",
          <Archive className="h-4 w-4" />,
          () => setArchiveOpen(true),
        )}
      </>
    );
  } else if (status === "watched") {
    actions = renderButton(
      "Return to watchlist",
      <RotateCcw className="h-4 w-4" />,
      () => onTransition("active"),
    );
  } else if (status === "archived") {
    actions = renderButton(
      "Re-enable on watchlist",
      <RotateCcw className="h-4 w-4" />,
      () => onTransition("active"),
    );
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
