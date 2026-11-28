"use client";

import { useEffect, useRef, useState } from "react";
import { FilmStripShuffle } from "@/components/film-strip-shuffle";
import { ProgrammeLayout } from "@/components/programme-layout";
import {
  SHUFFLE_MOTION,
  SHUFFLE_NOTES_LEAVE_MS,
  initialShuffleState,
  shuffleEaseOut,
  stepShuffle,
  type ShuffleFrame,
  type ShufflePhase,
} from "@/lib/recommendation-shuffle";
import { TONIGHT_PROGRAMME_TITLE } from "@/lib/programme-format";
import type { RecommendationDetailResponse, RecommendationResponse } from "@/types/api";

type Visual = {
  phase: ShufflePhase;
  offsetPx: number;
  highlightOpacity: number;
  expandProgress: number;
  landingIndex: number | null;
};

const CRUISE: Visual = {
  phase: "cruise",
  offsetPx: 0,
  highlightOpacity: 0,
  expandProgress: 0,
  landingIndex: null,
};

export function RecommendCue({
  frames,
  session,
  reduced,
  onSettled,
  onTabBar,
}: {
  frames: ShuffleFrame[];
  session: RecommendationResponse | null;
  reduced: boolean;
  onSettled: (sessionId: string) => void;
  onTabBar: (visible: boolean) => void;
}) {
  const framesRef = useRef(frames);
  const sessionRef = useRef(session);
  const onSettledRef = useRef(onSettled);
  const viewportRef = useRef<HTMLDivElement>(null);
  framesRef.current = frames;
  sessionRef.current = session;
  onSettledRef.current = onSettled;

  const [visual, setVisual] = useState<Visual>(CRUISE);
  const [intro, setIntro] = useState(0);
  const [cover, setCover] = useState(0);
  const [flyer, setFlyer] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
    opacity: number;
  } | null>(null);
  const rectsRef = useRef<{ land: DOMRect; hero: DOMRect } | null>(null);

  const showTabs =
    reduced
      ? session != null
      : visual.phase === "expand" || visual.phase === "settled";

  useEffect(() => {
    onTabBar(showTabs);
  }, [onTabBar, showTabs]);

  useEffect(() => {
    if (!reduced || !session) return;
    const sessionId = session.session_id;
    const start = performance.now();
    let raf = 0;
    const fade = (now: number) => {
      const u = Math.min(1, (now - start) / SHUFFLE_MOTION.reducedCrossfadeMs);
      setCover(shuffleEaseOut(u));
      if (u < 1) raf = requestAnimationFrame(fade);
    };
    raf = requestAnimationFrame(fade);
    const timer = window.setTimeout(() => {
      onSettledRef.current(sessionId);
    }, SHUFFLE_MOTION.reducedCrossfadeMs);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, [reduced, session]);

  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    let state = initialShuffleState();
    const start = performance.now();
    const tick = (now: number) => {
      const current = sessionRef.current;
      const elapsed = now - start;
      setIntro(shuffleEaseOut(Math.min(1, elapsed / SHUFFLE_NOTES_LEAVE_MS)));
      const step = stepShuffle(state, {
        elapsedMs: elapsed,
        responseReady: current != null,
        frames: framesRef.current,
        winnerFilmId: current?.winner.film_id ?? "",
        viewportWidthPx: viewportRef.current?.clientWidth || 390,
      });
      state = step.state;
      if (
        step.phase === "expand" &&
        !rectsRef.current &&
        typeof document !== "undefined"
      ) {
        const cell = document.querySelector("[data-landing='true'] [data-still]");
        const hero = document.querySelector("[data-programme] [aria-label='Your pick']");
        if (cell && hero) {
          rectsRef.current = {
            land: cell.getBoundingClientRect(),
            hero: hero.getBoundingClientRect(),
          };
        }
      }
      const rects = rectsRef.current;
      if (step.phase === "expand" && rects) {
        const p = shuffleEaseOut(step.expandProgress);
        const handoff = p > 0.76 ? (p - 0.76) / 0.24 : 0;
        setFlyer({
          left: rects.land.left + (rects.hero.left - rects.land.left) * p,
          top: rects.land.top + (rects.hero.top - rects.land.top) * p,
          width: rects.land.width + (rects.hero.width - rects.land.width) * p,
          height: rects.land.height + (rects.hero.height - rects.land.height) * p,
          opacity: 1 - handoff,
        });
      } else {
        setFlyer(null);
      }
      setVisual({
        phase: step.phase,
        offsetPx: step.offsetPx,
        highlightOpacity: step.highlightOpacity,
        expandProgress: step.expandProgress,
        landingIndex: step.landingIndex,
      });
      if (step.phase === "settled" && current) {
        onSettledRef.current(current.session_id);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  if (reduced) {
    if (!session) return null;
    return (
      <div
        className="fixed inset-0 z-30 overflow-y-auto bg-cb-bg px-4 pb-[calc(90px+env(safe-area-inset-bottom,0px))] pt-2"
        style={{ opacity: cover }}
        data-testid="recommend-reduced-crossfade"
        data-reduced-crossfade-ms={SHUFFLE_MOTION.reducedCrossfadeMs}
      >
        <ProgrammeLayout
          session={session as RecommendationDetailResponse}
          title={TONIGHT_PROGRAMME_TITLE}
          settled
        />
      </div>
    );
  }

  const stripFade =
    visual.phase === "expand"
      ? shuffleEaseOut(Math.min(1, (visual.expandProgress * SHUFFLE_MOTION.expandMs) / 240))
      : visual.phase === "settled"
        ? 1
        : 0;
  const stripOpacity = intro * (1 - stripFade);
  const showProgramme = session != null && (visual.phase === "expand" || visual.phase === "settled");
  const landingFrame =
    visual.landingIndex != null
      ? frames[visual.landingIndex % Math.max(frames.length, 1)]
      : null;

  return (
    <div ref={viewportRef} className="relative min-h-[calc(100dvh-1rem)]">
      {showProgramme && session ? (
        <div data-hero-hold={visual.phase === "expand" ? "true" : "false"}>
          <ProgrammeLayout
            session={session as RecommendationDetailResponse}
            title={TONIGHT_PROGRAMME_TITLE}
          />
        </div>
      ) : null}
      {visual.phase !== "settled" ? (
        <div
          className="fixed inset-0 z-30 flex flex-col items-center justify-center bg-cb-bg"
          style={{ opacity: stripOpacity, pointerEvents: visual.phase === "expand" ? "none" : "auto" }}
          role="status"
          aria-live="polite"
          aria-label="Cueing your pick"
        >
          <h1 className="font-display text-[32px] font-bold leading-9 tracking-[0.01em]">
            Cueing your pick
          </h1>
          <p className="mb-7 mt-2 font-mono text-xs tracking-[0.04em] text-cb-muted">
            From your watchlist
          </p>
          <div className="w-full max-w-[390px]">
            <FilmStripShuffle
              frames={frames}
              offsetPx={visual.offsetPx}
              landingIndex={visual.landingIndex}
              highlightOpacity={visual.highlightOpacity}
              phase={visual.phase}
            />
          </div>
        </div>
      ) : null}
      {flyer && landingFrame?.backdropUrl ? (
        <img
          src={landingFrame.backdropUrl}
          alt=""
          className="pointer-events-none fixed z-40 object-cover"
          style={{
            left: flyer.left,
            top: flyer.top,
            width: flyer.width,
            height: flyer.height,
            opacity: flyer.opacity,
            borderRadius: `${1 + 11 * visual.expandProgress}px`,
          }}
        />
      ) : null}
    </div>
  );
}
