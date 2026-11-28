"use client";

import * as React from "react";
import { Toaster as SonnerToaster, toast as sonnerToast } from "sonner";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { toastMotion } from "@/lib/motion";

export type CueToastInput = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: "default" | "destructive";
};

/** Sonner toast. There is no undo action. */
export function toast({ title, description, variant }: CueToastInput) {
  const motion = toastMotion(
    typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const options = {
    description,
    duration: motion.stayMs,
  };
  if (variant === "destructive") {
    return sonnerToast.error(title ?? "Request failed", options);
  }
  return sonnerToast(title ?? "", options);
}

export function Toaster() {
  const reduced = useReducedMotion();
  const motion = toastMotion(reduced);

  return (
    <SonnerToaster
      theme="dark"
      position="top-center"
      duration={motion.stayMs}
      closeButton={false}
      className={reduced ? "cb-toaster cb-toaster-reduced" : "cb-toaster"}
      toastOptions={{
        className: "cb-toast",
        closeButton: false,
      }}
      style={{
        ["--cb-toast-in" as string]: `${motion.enterMs}ms`,
        ["--cb-toast-out" as string]: `${motion.exitMs}ms`,
        ["--cb-toast-travel" as string]: `${motion.travelPx}px`,
        ["--cb-toast-stay" as string]: `${motion.stayMs}ms`,
      }}
    />
  );
}
