"use client";

import { Command } from "cmdk";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { cueboxEase, searchMotion } from "@/lib/motion";

type SearchCardProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children?: React.ReactNode;
};

/**
 * cmdk card that fades over the current screen.
 * Film groups and results are wired by the search screen ticket.
 */
export function SearchCard({ open, onOpenChange, children }: SearchCardProps) {
  const reduced = useReducedMotion();
  const spec = searchMotion(reduced);
  const ease = spec.travel === "none" ? "linear" : cueboxEase;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[60]">
          <motion.button
            type="button"
            aria-label="Close search"
            className="absolute inset-0 cursor-default border-0 bg-black"
            initial={{ opacity: 0 }}
            animate={{ opacity: spec.dim, transition: { duration: spec.open.duration, ease: "linear" } }}
            exit={{ opacity: 0, transition: { duration: spec.close.duration, ease: "linear" } }}
            onClick={() => onOpenChange(false)}
          />
          <motion.div
            role="dialog"
            aria-label="Search films"
            data-cb-search=""
            data-cb-reduced={reduced ? "true" : "false"}
            data-open-ms={spec.openMs}
            data-close-ms={spec.closeMs}
            data-from-scale={spec.fromScale}
            data-travel={spec.travel}
            className="absolute inset-x-4 top-[calc(52px+env(safe-area-inset-top,0px)+8px)] overflow-hidden rounded-cb border border-cb-divider bg-cb-surface text-cb-text shadow-none"
            initial={{ opacity: 0, scale: spec.fromScale }}
            animate={{
              opacity: 1,
              scale: 1,
              transition: { duration: spec.open.duration, ease },
            }}
            exit={{
              opacity: 0,
              scale: spec.fromScale,
              transition: { duration: spec.close.duration, ease },
            }}
          >
            <Command label="Search films" className="bg-cb-surface text-cb-text">
              {children ?? (
                <>
                  <Command.Input
                    autoFocus
                    placeholder="Search films"
                    aria-label="Search query"
                    className="w-full border-b border-cb-divider bg-transparent px-4 py-3 font-ui text-cb-body text-cb-text outline-none placeholder:text-cb-muted"
                  />
                  <Command.List className="max-h-72 overflow-y-auto p-2">
                    <Command.Empty className="px-3 py-6 text-center font-ui text-cb-caption text-cb-muted">
                      Search films
                    </Command.Empty>
                  </Command.List>
                </>
              )}
            </Command>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
