"use client";

import { useEffect, useState } from "react";

function reducedMotionQuery(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return null;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)");
}

/**
 * Reduced-motion contract for the shared kit: appear at once, or a 300ms fade.
 * No travel, scale, or glow. Starts false so the server render matches the
 * first client paint, then follows the media query.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = reducedMotionQuery();
    if (!query) return;
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return reduced;
}
