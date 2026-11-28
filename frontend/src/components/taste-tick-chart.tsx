"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import {
  formatTasteScore,
  tasteTickMotion,
  tickFills,
  type TasteTickMotion,
  type TickFill,
} from "@/lib/taste-ticks";

const ROWS = [
  { key: "pacing", name: "Pacing", low: "Slow", high: "Fast" },
  { key: "complexity", name: "Complexity", low: "Simple", high: "Complex" },
  { key: "energy", name: "Energy", low: "Calm", high: "Intense" },
  { key: "obscurity", name: "Obscurity", low: "Known", high: "Niche" },
] as const;

export type TasteProfileScores = {
  pacing: number | null;
  complexity: number | null;
  energy: number | null;
  obscurity: number | null;
};

type Ease = TasteTickMotion["ease"];

export function TasteTickChart({ scores }: { scores: TasteProfileScores }) {
  const reduced = useReducedMotion();
  const motionSpec = tasteTickMotion(reduced);
  const ref = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (typeof IntersectionObserver === "undefined") {
      setPlaying(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        const visible = entry.intersectionRatio >= motionSpec.triggerRatio;
        if (!visible) return;
        setPlaying(true);
        observer.disconnect();
      },
      { threshold: [motionSpec.triggerRatio] },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [motionSpec.triggerRatio]);

  const rows = ROWS.flatMap((row) => {
    const score = scores[row.key];
    if (score == null || !Number.isFinite(score)) return [];
    return [{ ...row, score }];
  });

  if (rows.length === 0) return null;

  return (
    <div
      ref={ref}
      data-testid="taste-ticks"
      data-glow="off"
      data-trigger={String(motionSpec.triggerRatio)}
      data-playing={playing ? "true" : "false"}
      data-reduced={reduced ? "true" : "false"}
      data-fade-together={motionSpec.fadeTogether ? "true" : "false"}
      className="flex flex-col gap-4"
    >
      {rows.map((row, rowIndex) => {
        const fills = tickFills(row.score);
        return (
          <div key={row.key}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="font-ui text-cb-ui font-semibold">{row.name}</span>
              <span className="font-mono text-cb-caption text-cb-muted">
                {formatTasteScore(row.score)}
              </span>
            </div>
            <div
              className="flex h-4 gap-[3px]"
              aria-label={`${row.name} ${row.score.toFixed(1)} of 10`}
            >
              {fills.map((fill, tickIndex) => (
                <Tick
                  key={tickIndex}
                  fill={fill}
                  playing={playing}
                  reduced={reduced}
                  delayMs={
                    motionSpec.fadeTogether
                      ? 0
                      : rowIndex * motionSpec.rowDelayMs +
                        tickIndex * motionSpec.perTickMs
                  }
                  fillMs={motionSpec.fillMs}
                  ease={motionSpec.ease}
                />
              ))}
            </div>
            <div className="mt-1.5 flex justify-between font-mono text-[10px] uppercase tracking-[0.04em] text-cb-muted">
              <span>{row.low}</span>
              <span>{row.high}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Tick({
  fill,
  playing,
  reduced,
  delayMs,
  fillMs,
  ease,
}: {
  fill: TickFill;
  playing: boolean;
  reduced: boolean;
  delayMs: number;
  fillMs: number;
  ease: Ease;
}) {
  return (
    <span
      className="block h-4 min-w-0 flex-1"
      data-fill={String(fill)}
      data-delay-ms={fill === 0 ? undefined : String(delayMs)}
      data-fill-ms={fill === 0 ? undefined : String(fillMs)}
    >
      <span className="relative block h-4 overflow-hidden rounded-[2px] bg-cb-divider">
        {fill > 0 && (
          <motion.span
            data-tick-bar=""
            className="absolute inset-y-0 left-0 block bg-cb-teal"
            style={{
              width: fill === 0.5 ? "50%" : "100%",
              transformOrigin: "left center",
              filter: "none",
            }}
            initial={reduced ? { scaleX: 1, opacity: 0 } : { scaleX: 0, opacity: 1 }}
            animate={
              playing
                ? { scaleX: 1, opacity: 1 }
                : reduced
                  ? { scaleX: 1, opacity: 0 }
                  : { scaleX: 0, opacity: 1 }
            }
            transition={
              reduced
                ? { duration: fillMs / 1000, ease: "linear", delay: 0 }
                : { duration: fillMs / 1000, ease, delay: delayMs / 1000 }
            }
          />
        )}
      </span>
    </span>
  );
}
