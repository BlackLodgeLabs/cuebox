"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { confirmMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  pending?: boolean;
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
  pending = false,
}: ConfirmDialogProps) {
  const reduced = useReducedMotion();
  const spec = confirmMotion(reduced);

  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay
          className="cb-confirm-overlay fixed inset-0 z-[70]"
          style={{
            ["--cb-dialog-dim" as string]: String(spec.dim),
            ["--cb-dialog-dur" as string]: `${spec.durationMs}ms`,
          }}
        />
        <AlertDialog.Content
          data-cb-confirm=""
          data-cb-reduced={reduced ? "true" : "false"}
          data-duration-ms={spec.durationMs}
          data-from-scale={spec.fromScale}
          data-travel={spec.travel}
          className="cb-confirm fixed left-1/2 top-1/2 z-[70] grid w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 gap-4 rounded-cb-lg border border-cb-divider bg-cb-surface p-6 text-cb-text outline-none"
          style={{
            ["--cb-dialog-dur" as string]: `${spec.durationMs}ms`,
            ["--cb-dialog-from-scale" as string]: String(spec.fromScale),
          }}
        >
          <div className="flex flex-col space-y-2 text-center sm:text-left">
            <AlertDialog.Title className="font-display text-cb-section text-cb-text">
              {title}
            </AlertDialog.Title>
            <AlertDialog.Description className="font-ui text-cb-caption text-cb-muted">
              {description}
            </AlertDialog.Description>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <AlertDialog.Cancel
              className={cn(buttonVariants({ variant: "outline" }), "h-11")}
              disabled={pending}
            >
              {cancelLabel}
            </AlertDialog.Cancel>
            <AlertDialog.Action
              className={cn(buttonVariants({ variant: "destructive" }), "h-11")}
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                onConfirm();
              }}
            >
              {confirmLabel}
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
