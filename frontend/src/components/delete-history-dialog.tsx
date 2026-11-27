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
      title="Remove from history"
      description="Are you sure you want to remove this from your history? This cannot be undone."
      confirmLabel={isPending ? "Removing…" : "Remove"}
      onConfirm={onConfirm}
      pending={isPending}
    />
  );
}
