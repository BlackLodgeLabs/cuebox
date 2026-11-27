"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { revealMotion } from "@/lib/motion";

type RevealProps = {
  open: boolean;
  children: React.ReactNode;
  className?: string;
};

/** Synopsis “More”: 300ms height and fade. Reduced motion fades only. */
export function Reveal({ open, children, className }: RevealProps) {
  const spec = revealMotion(useReducedMotion());

  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          data-cb-reveal=""
          data-duration-ms={spec.durationMs}
          data-travel={spec.animateHeight ? "height" : "none"}
          className={className}
          style={{ overflow: "hidden" }}
          initial={spec.animateHeight ? { height: 0, opacity: 0 } : { height: "auto", opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={spec.animateHeight ? { height: 0, opacity: 0 } : { height: "auto", opacity: 0 }}
          transition={spec.transition}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
