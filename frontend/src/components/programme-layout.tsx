"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useFilmsWatchProviders } from "@/hooks/use-watch-providers";
import {
  filmDetailLine,
  firstServiceName,
  formatProgrammeDate,
  preferenceSummaryText,
  programmeSubline,
} from "@/lib/programme-format";
import { programmeSettleMotion, type CueEase } from "@/lib/motion";
import type { FilmResult, RecommendationDetailResponse } from "@/types/api";

export type ProgrammeBackLink = {
  href: string;
  label: string;
};

type SettleSpec = {
  risePx: number;
  staggerMs: number;
  durationMs: number;
  travel: "y" | "none";
  ease: CueEase;
};

function SettleItem({
  index,
  settle,
  children,
  className,
}: {
  index: number;
  settle: SettleSpec;
  children: React.ReactNode;
  className?: string;
}) {
  const reduced = settle.travel === "none";
  return (
    <motion.div
      className={className}
      initial={reduced ? { opacity: 1, y: 0 } : { opacity: 0, y: settle.risePx }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: settle.durationMs / 1000,
        ease: settle.ease,
        delay: (index * settle.staggerMs) / 1000,
      }}
      data-settle=""
      data-settle-index={index}
      data-rise-px={settle.risePx}
      data-duration-ms={settle.durationMs}
      data-stagger-ms={settle.staggerMs}
      data-delay-ms={index * settle.staggerMs}
      data-travel={settle.travel}
    >
      {children}
    </motion.div>
  );
}

function Still({
  src,
  className,
  frame = false,
}: {
  src: string | null;
  className: string;
  /** Keep a blank tile when a poster is missing or fails, so the row does not collapse. */
  frame?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    if (!frame) return null;
    return <div aria-hidden data-still-frame="" className={className} />;
  }
  return (
    <img
      src={src}
      alt=""
      className={className}
      onError={() => setFailed(true)}
    />
  );
}

function FilmMeta({
  film,
  service,
}: {
  film: FilmResult;
  service: string | null;
}) {
  const line = filmDetailLine(film, service);
  if (!line) return null;
  return <p className="font-mono text-xs leading-4 text-cb-muted">{line}</p>;
}

/**
 * Locked programme shared by a fresh pick and a past night.
 * Routes stay with S7 and S9; this is the layout only.
 */
export function ProgrammeLayout({
  session,
  title,
  backLink,
}: {
  session: RecommendationDetailResponse;
  title: string;
  backLink?: ProgrammeBackLink;
}) {
  const reduced = useReducedMotion();
  const settle = programmeSettleMotion(reduced);
  const filmIds = [session.winner.film_id, ...session.runners_up.map((film) => film.film_id)];
  const providers = useFilmsWatchProviders(filmIds);
  const winnerService = firstServiceName(providers.get(session.winner.film_id)?.data?.categories);
  const summary = preferenceSummaryText(session.profile_summary?.narrative_profile);
  const subline = programmeSubline(session.created_at, summary);
  const why =
    session.winner.explanation.why_it_matches.trim() ||
    session.winner.explanation.why_it_matches_short?.trim() ||
    "";
  const sideDate = backLink ? "" : formatProgrammeDate(session.created_at);
  let settleIndex = 0;

  return (
    <section className="pb-2" data-programme="">
      {backLink ? (
        <Link
          href={backLink.href}
          aria-label={`Back to ${backLink.label}`}
          className="mb-2 inline-flex h-8 items-center gap-1 font-ui text-cb-caption font-medium text-cb-teal"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M15 5 8 12l7 7" />
          </svg>
          {backLink.label}
        </Link>
      ) : null}

      <SettleItem index={settleIndex++} settle={settle}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="whitespace-nowrap font-display text-cb-title leading-[1.05] tracking-[-0.02em]">
              {title}
            </h1>
            <span
              aria-hidden
              data-programme-hairline
              className="mt-2 block h-0.5 w-9 bg-cb-teal"
            />
          </div>
          {sideDate ? (
            <time
              dateTime={session.created_at}
              className="whitespace-nowrap pt-2 font-mono text-xs leading-4 text-cb-muted"
            >
              {sideDate}
            </time>
          ) : null}
        </div>
      </SettleItem>

      {subline ? (
        <SettleItem index={settleIndex++} settle={settle} className="mb-4 mt-2">
          <p className="font-ui text-cb-caption leading-[18px] text-cb-muted">{subline}</p>
        </SettleItem>
      ) : null}

      <article
        aria-label="Your pick"
        className="relative h-[220px] overflow-hidden rounded-cb bg-cb-surface"
      >
        <Still
          src={session.winner.backdrop_url}
          className="h-full w-full object-cover object-[center_40%]"
        />
        <SettleItem
          index={settleIndex++}
          settle={settle}
          className="absolute inset-x-0 bottom-0 px-4 pb-4 pt-12"
        >
          <div
            style={{
              background:
                "linear-gradient(to top, rgba(11,11,11,0.94) 0%, rgba(11,11,11,0.55) 62%, rgba(11,11,11,0) 100%)",
            }}
            className="absolute inset-0"
            aria-hidden
          />
          <div className="relative">
            <p className="text-xs font-medium leading-4 text-[#C8C3BA]">Your pick</p>
            <h2 className="mt-0.5 font-display text-cb-display leading-[1.05]">
              {session.winner.title}
            </h2>
            <FilmMeta film={session.winner} service={winnerService} />
          </div>
        </SettleItem>
      </article>

      {why ? (
        <SettleItem index={settleIndex++} settle={settle} className="my-4">
          <p className="font-ui text-cb-ui leading-5 text-cb-text">{why}</p>
        </SettleItem>
      ) : null}

      <SettleItem index={settleIndex++} settle={settle}>
        <Button variant="secondary" size="lg" className="w-full font-semibold shadow-none" asChild>
          <Link href={`/watchlist/${session.winner.film_id}`}>View your pick</Link>
        </Button>
      </SettleItem>

      {session.runners_up.length > 0 ? (
        <SettleItem index={settleIndex++} settle={settle}>
          <p className="mb-0 mt-8 border-b border-cb-divider pb-2 font-ui text-cb-tab font-semibold uppercase tracking-[0.08em] text-cb-muted">
            Runners-up
          </p>
          <ol>
            {session.runners_up.map((film) => {
              const service = firstServiceName(providers.get(film.film_id)?.data?.categories);
              const meta = filmDetailLine(film);
              const synopsis = film.synopsis?.trim() ?? "";
              return (
                <li
                  key={film.film_id}
                  className="flex gap-4 border-b border-cb-divider py-4"
                >
                  <Still
                    src={film.poster_url}
                    frame
                    className="h-24 w-16 shrink-0 rounded-cb-sm bg-cb-surface object-cover"
                  />
                  <div className="min-w-0">
                    <h3 className="font-display text-[20px] font-bold leading-[22px] text-cb-text">
                      {film.title}
                    </h3>
                    {meta ? (
                      <p className="mt-1 font-mono text-xs leading-4 text-cb-muted">{meta}</p>
                    ) : null}
                    {synopsis ? (
                      <p className="my-1 font-ui text-cb-caption leading-[18px] text-cb-text">
                        {synopsis}
                      </p>
                    ) : null}
                    {service ? (
                      <p className="font-ui text-xs leading-4 text-cb-muted">{service}</p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </SettleItem>
      ) : null}
    </section>
  );
}
