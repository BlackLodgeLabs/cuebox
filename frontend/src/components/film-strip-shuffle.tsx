"use client";

import {
  SHUFFLE_FRAME_STRIDE_PX,
  SHUFFLE_MOTION,
  type ShuffleFrame,
  type ShufflePhase,
} from "@/lib/recommendation-shuffle";

const STRIP_HEIGHT = 196;

export function FilmStripShuffle({
  frames,
  offsetPx,
  landingIndex,
  highlightOpacity,
  phase,
}: {
  frames: ShuffleFrame[];
  offsetPx: number;
  landingIndex: number | null;
  highlightOpacity: number;
  phase: ShufflePhase;
}) {
  const count = Math.max(frames.length, 1);
  const rendered = Math.max(
    count,
    landingIndex != null ? landingIndex + 3 : 0,
    Math.ceil((offsetPx + 800) / SHUFFLE_FRAME_STRIDE_PX) + 2,
  );
  const cells = Array.from({ length: rendered }, (_, index) => frames[index % count]);

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ height: STRIP_HEIGHT }}
      data-testid="film-strip"
      data-cruise-px-s={SHUFFLE_MOTION.cruisePxPerSec}
      data-phase={phase}
    >
      <div
        className="pointer-events-none absolute inset-y-0 left-0 z-[3] w-9"
        style={{ background: "linear-gradient(to right, #0B0B0B, rgba(11,11,11,0))" }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-[3] w-9"
        style={{ background: "linear-gradient(to left, #0B0B0B, rgba(11,11,11,0))" }}
        aria-hidden
      />
      <div
        className="absolute left-0 top-0 flex h-full bg-[#141414]"
        style={{
          transform: `translate3d(${-offsetPx}px, 0, 0)`,
          boxShadow:
            "inset 0 1px 0 rgba(243,237,228,0.06), inset 0 -1px 0 rgba(0,0,0,0.4)",
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-[2] h-4"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 4px 3px at 50% 50%, #0B0B0B 70%, transparent 74%)",
            backgroundSize: "14px 16px",
            backgroundRepeat: "repeat-x",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-4"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 4px 3px at 50% 50%, #0B0B0B 70%, transparent 74%)",
            backgroundSize: "14px 16px",
            backgroundRepeat: "repeat-x",
          }}
        />
        {cells.map((frame, index) => {
          const landing = index === landingIndex;
          return (
            <div
              key={`${frame.filmId}-${index}`}
              data-film-id={frame.filmId}
              data-landing={landing ? "true" : undefined}
              className="relative h-full shrink-0"
              style={{ width: SHUFFLE_FRAME_STRIDE_PX }}
            >
              {frame.backdropUrl ? (
                <img
                  src={frame.backdropUrl}
                  alt=""
                  data-still=""
                  className="absolute bottom-[18px] left-[7px] right-[7px] top-[18px] object-cover"
                />
              ) : (
                <div
                  aria-hidden
                  data-still=""
                  className="absolute bottom-[18px] left-[7px] right-[7px] top-[18px] bg-cb-surface"
                />
              )}
              <div
                aria-hidden
                className="pointer-events-none absolute bottom-[18px] left-[6px] right-[6px] top-[18px]"
                style={{
                  opacity: landing ? highlightOpacity : 0,
                  boxShadow: SHUFFLE_MOTION.highlightShadow,
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
