"use client";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface DeleteHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending: boolean;
}

export function DeleteHistoryDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending,
}: DeleteHistoryDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Remove this night?"
      description="It will be deleted from History. This does not change the film on your watchlist."
      confirmLabel={isPending ? "Removing…" : "Remove"}
      onConfirm={onConfirm}
      pending={isPending}
    />
  );
}
