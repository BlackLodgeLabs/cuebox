"use client";

import { useRef, useState } from "react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { historyStubParts, historyWatchMark } from "@/lib/history-format";
import { pressMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { HistoryCard } from "@/types/api";

const LONG_PRESS_MS = 520;
const SWIPE_START_PX = 8;
const SWIPE_COMMIT_PX = 56;
const RAIL_PX = 88;

type Drag = {
  pointerId: number;
  x: number;
  y: number;
  dx: number;
  swiping: boolean;
  longFired: boolean;
  timer: number;
};

function initials(title: string): string {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

export function HistoryTicket({
  item,
  onOpen,
  onRemove,
}: {
  item: HistoryCard;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const reduced = useReducedMotion();
  const press = pressMotion(reduced);
  const drag = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
  const [offset, setOffset] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const stub = historyStubParts(item.created_at);
  const mark = historyWatchMark(item.history_status_tag, item.winner_watch_status);
  const year = item.winner_year != null ? String(item.winner_year) : "";

  function clearDragTimer() {
    if (drag.current) {
      window.clearTimeout(drag.current.timer);
    }
  }

  function resetRail() {
    setOffset(0);
    setRevealed(false);
    setDragging(false);
  }

  function onPointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const timer = window.setTimeout(() => {
      const current = drag.current;
      if (!current || current.swiping) return;
      current.longFired = true;
      suppressClick.current = true;
      resetRail();
      onRemove();
    }, LONG_PRESS_MS);
    drag.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      dx: 0,
      swiping: false,
      longFired: false,
      timer,
    };
  }

  function onPointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    const current = drag.current;
    if (!current || current.longFired || current.pointerId !== event.pointerId) return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    if (Math.abs(dx) > SWIPE_START_PX || Math.abs(dy) > SWIPE_START_PX) {
      window.clearTimeout(current.timer);
    }
    if (dx < -SWIPE_START_PX && Math.abs(dx) > Math.abs(dy)) {
      current.swiping = true;
      current.dx = Math.max(dx, -96);
      setDragging(true);
      setRevealed(true);
      setOffset(current.dx);
    }
  }

  function onPointerUp(event: React.PointerEvent<HTMLButtonElement>) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    clearDragTimer();
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (current.longFired) {
      resetRail();
      return;
    }
    if (current.swiping) {
      suppressClick.current = true;
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 0);
      if (current.dx < -SWIPE_COMMIT_PX) {
        setDragging(false);
        setRevealed(true);
        setOffset(-RAIL_PX);
        window.setTimeout(() => {
          resetRail();
          onRemove();
        }, 180);
      } else {
        resetRail();
      }
    }
  }

  function onPointerCancel(event: React.PointerEvent<HTMLButtonElement>) {
    clearDragTimer();
    drag.current = null;
    suppressClick.current = true;
    resetRail();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <div className="relative mb-2.5 overflow-hidden rounded-cb">
      <button
        type="button"
        data-remove-rail=""
        data-revealed={revealed ? "true" : "false"}
        aria-hidden={!revealed}
        tabIndex={revealed ? 0 : -1}
        className={cn(
          "absolute inset-y-0 right-0 z-0 flex w-[88px] items-center justify-center bg-cb-danger font-ui text-[13px] font-semibold text-cb-text",
          revealed ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={(event) => {
          event.stopPropagation();
          resetRail();
          onRemove();
        }}
      >
        Remove
      </button>
      <button
        type="button"
        aria-label={year ? `${item.winner_title}, ${year}` : item.winner_title}
        data-history-ticket=""
        className="cb-press relative z-[1] flex min-h-[108px] w-full touch-pan-y overflow-hidden rounded-cb bg-cb-surface text-left outline-none focus-visible:outline focus-visible:outline-[1.5px] focus-visible:outline-offset-2 focus-visible:outline-cb-muted"
        style={
          {
            ["--cb-press-scale" as string]: String(press.scale),
            ["--cb-press-down" as string]: `${press.downMs}ms`,
            ["--cb-press-up" as string]: `${press.upMs}ms`,
            ...(offset !== 0
              ? {
                  transform: `translateX(${offset}px)`,
                  transition: dragging
                    ? "none"
                    : "transform 200ms var(--cb-ease-out)",
                }
              : {}),
          } as React.CSSProperties
        }
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onContextMenu={(event) => event.preventDefault()}
        onClick={() => {
          if (suppressClick.current) {
            suppressClick.current = false;
            return;
          }
          // Let the 200ms release finish, then open. Reduced motion has no scale.
          if (press.upMs === 0) {
            onOpen();
            return;
          }
          window.setTimeout(onOpen, press.upMs);
        }}
      >
        <div className="history-stub flex flex-col items-center justify-center gap-0.5 bg-[#121212] px-1 py-2.5">
          <span className="font-mono text-[10px] uppercase leading-tight tracking-[0.08em] text-cb-muted">
            {stub.weekday}
          </span>
          <span className="font-display text-[28px] leading-7 text-cb-text">{stub.day}</span>
          <span className="font-mono text-[10px] uppercase leading-tight tracking-[0.08em] text-cb-muted">
            {stub.month}
          </span>
        </div>
        <div className="my-1.5 ml-2.5 h-24 w-16 shrink-0 overflow-hidden rounded-cb-sm bg-[#111]">
          {item.winner_poster_url ? (
            <img
              src={item.winner_poster_url}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full items-center justify-center font-display text-lg text-[#6E6A64]">
              {initials(item.winner_title)}
            </span>
          )}
        </div>
        <div className="relative flex min-w-0 flex-1 flex-col justify-center px-3 py-3">
          <span
            className={cn(
              "absolute right-2.5 top-2.5 rounded border px-1.5 py-[3px] font-mono text-[9px] uppercase tracking-[0.06em]",
              mark.watched
                ? "border-cb-teal/45 text-cb-teal"
                : "border-cb-divider text-cb-muted",
            )}
          >
            {mark.label}
          </span>
          <p className="line-clamp-2 pr-16 font-display text-cb-card leading-5 text-cb-text">
            {item.winner_title}
          </p>
          {year ? (
            <p className="mt-0.5 pr-16 font-mono text-cb-meta text-cb-muted">{year}</p>
          ) : null}
          {item.preference_summary ? (
            <p className="mt-1.5 line-clamp-2 font-ui text-xs leading-4 text-cb-muted">
              {item.preference_summary}
            </p>
          ) : null}
        </div>
      </button>
    </div>
  );
}
