"use client";

import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  HOME_ARRIVAL,
  arrivalDelayMs,
  irisProgress,
  irisRadiusPx,
  irisSoftEdgePx,
  splashStopOpacity,
  splashWordmarkOpacity,
} from "@/lib/home-arrival";
import { cueboxEase } from "@/lib/motion";

type ArrivalPhase = "boot" | "play" | "settled";

const ArrivalContext = createContext<ArrivalPhase>("settled");

export function useArrivalPhase(): ArrivalPhase {
  return useContext(ArrivalContext);
}

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function shouldPlayArrival(pathname: string): boolean {
  if (pathname !== "/") return false;
  if (typeof window.matchMedia !== "function") return false;
  return !prefersReducedMotion();
}

/** 1× logo-unfold milliseconds, played at the locked 0.85× speed. */
function wallSeconds(msAt1x: number): number {
  return Math.round(msAt1x / HOME_ARRIVAL.logoScale) / 1000;
}

const HOLD_1X = 150;
const STAGGER_1X = 190;
const DROP_1X = 420;
const SETTLE_1X = 90;

const LETTERS = [
  { char: "u", tone: "text-cb-accent" },
  { char: "e", tone: "text-cb-accent" },
  { char: "b", tone: "text-cb-teal" },
  { char: "o", tone: "text-cb-teal" },
  { char: "x", tone: "text-cb-teal" },
] as const;

function LogoUnfold({ stopRef }: { stopRef: React.RefObject<HTMLSpanElement | null> }) {
  return (
    <div className="relative font-display text-[18vw] leading-none tracking-normal text-cb-text sm:text-[84px]">
      <motion.span
        className="inline-block text-cb-accent"
        initial={{ scale: 1.45, opacity: 1 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          delay: wallSeconds(HOLD_1X),
          duration: wallSeconds(420),
          ease: [0.22, 0.82, 0.24, 1],
        }}
      >
        C
      </motion.span>
      {LETTERS.map((letter, index) => (
        <motion.span
          key={letter.char}
          className={`inline-block ${letter.tone}`}
          initial={{ y: "0.55em", opacity: 0 }}
          animate={{ y: ["0.55em", "-0.05em", "0em"], opacity: [0, 1, 1] }}
          transition={{
            delay: wallSeconds(HOLD_1X + index * STAGGER_1X),
            duration: wallSeconds(DROP_1X + SETTLE_1X),
            times: [0, DROP_1X / (DROP_1X + SETTLE_1X), 1],
            ease: [
              [0.33, 0, 0.67, 1],
              [0.2, 0.8, 0.2, 1],
            ],
          }}
        >
          {letter.char}
        </motion.span>
      ))}
      <motion.span
        ref={stopRef}
        className="inline-block text-cb-teal"
        initial={{ y: "0.55em", opacity: 0 }}
        animate={{ y: ["0.55em", "-0.05em", "0em"], opacity: [0, 1, 1] }}
        transition={{
          delay: wallSeconds(HOLD_1X + LETTERS.length * STAGGER_1X),
          duration: wallSeconds(DROP_1X + SETTLE_1X),
          times: [0, DROP_1X / (DROP_1X + SETTLE_1X), 1],
          ease: [
            [0.33, 0, 0.67, 1],
            [0.2, 0.8, 0.2, 1],
          ],
        }}
      >
        .
      </motion.span>
    </div>
  );
}

function HomeSplash() {
  const bgRef = useRef<HTMLDivElement>(null);
  const wordmarkRef = useRef<HTMLDivElement>(null);
  const stopRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const started = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const elapsed = now - started;
      const background = bgRef.current;
      const wordmark = wordmarkRef.current;
      const stop = stopRef.current;
      if (background) {
        const progress = irisProgress(elapsed);
        if (progress <= 0 || !stop) {
          background.style.maskImage = "";
          background.style.setProperty("-webkit-mask-image", "");
        } else {
          const rect = stop.getBoundingClientRect();
          const x = rect.left + rect.width / 2;
          const y = rect.top + rect.height / 2;
          const stopRadius = Math.hypot(rect.width / 2, rect.height / 2) + 0.5;
          const soft = irisSoftEdgePx(elapsed);
          const far = Math.hypot(
            Math.max(x, window.innerWidth - x),
            Math.max(y, window.innerHeight - y),
          ) + soft + 8;
          const radius = irisRadiusPx(elapsed, stopRadius, far);
          const inner = Math.max(0, radius - soft);
          const image = `radial-gradient(circle at ${x}px ${y}px, transparent ${inner}px, #000 ${radius}px)`;
          background.style.maskImage = image;
          background.style.setProperty("-webkit-mask-image", image);
        }
      }
      if (stop && elapsed >= HOME_ARRIVAL.irisStartMs) {
        stop.style.opacity = String(splashStopOpacity(elapsed));
      }
      if (wordmark) {
        wordmark.style.opacity = String(splashWordmarkOpacity(elapsed));
      }
      if (elapsed < HOME_ARRIVAL.irisStartMs + HOME_ARRIVAL.irisDurationMs) {
        frame = requestAnimationFrame(tick);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      data-testid="home-arrival-splash"
      data-logo-wall-ms={HOME_ARRIVAL.logoWallMs}
      data-wordmark-lock-ms={HOME_ARRIVAL.wordmarkLockMs}
      data-iris-start-ms={HOME_ARRIVAL.irisStartMs}
      data-iris-duration-ms={HOME_ARRIVAL.irisDurationMs}
      data-iris-ease={HOME_ARRIVAL.irisEase.join(",")}
      data-soft-edge-from={HOME_ARRIVAL.softEdgeFromPx}
      data-soft-edge-to={HOME_ARRIVAL.softEdgeToPx}
      data-wordmark-fade-ms={HOME_ARRIVAL.wordmarkFadeMs}
      data-chrome-start-ms={HOME_ARRIVAL.chromeStartMs}
      data-rest-start-ms={HOME_ARRIVAL.restStartMs}
      data-rest-rise-px={HOME_ARRIVAL.restRisePx}
      data-rest-stagger-ms={HOME_ARRIVAL.restStaggerMs}
      className="pointer-events-none fixed inset-0 z-[70]"
      aria-hidden
    >
      <div ref={bgRef} className="absolute inset-0 bg-cb-bg" />
      <div ref={wordmarkRef} className="absolute inset-0 grid place-items-center">
        <LogoUnfold stopRef={stopRef} />
      </div>
    </div>
  );
}

export function HomeArrivalProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [phase, setPhase] = useState<ArrivalPhase>("boot");
  const [showSplash, setShowSplash] = useState(false);
  const decided = useRef(false);

  useLayoutEffect(() => {
    if (decided.current) return;
    decided.current = true;
    if (shouldPlayArrival(pathname)) {
      setPhase("play");
      setShowSplash(true);
    } else {
      setPhase("settled");
      setShowSplash(false);
    }
  }, [pathname]);

  useEffect(() => {
    if (phase !== "play") return;
    const hideSplash = window.setTimeout(() => {
      setShowSplash(false);
    }, HOME_ARRIVAL.irisStartMs + HOME_ARRIVAL.irisDurationMs);
    const settle = window.setTimeout(
      () => setPhase("settled"),
      HOME_ARRIVAL.restStartMs + HOME_ARRIVAL.restStaggerMs * 8 + HOME_ARRIVAL.restDurationMs,
    );
    return () => {
      window.clearTimeout(hideSplash);
      window.clearTimeout(settle);
    };
  }, [phase]);

  return (
    <ArrivalContext.Provider value={phase}>
      {children}
      {showSplash ? <HomeSplash /> : null}
    </ArrivalContext.Provider>
  );
}

export function ArrivalRise({
  index = 0,
  slot = "rest",
  className,
  children,
}: {
  index?: number;
  slot?: "title" | "rest";
  className?: string;
  children: React.ReactNode;
}) {
  const phase = useArrivalPhase();
  if (phase !== "play") {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: HOME_ARRIVAL.restRisePx }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: arrivalDelayMs(slot, index) / 1000,
        duration: HOME_ARRIVAL.restDurationMs / 1000,
        ease: cueboxEase,
      }}
    >
      {children}
    </motion.div>
  );
}

export function arrivalChromeTransition(playing: boolean) {
  if (!playing) return { duration: 0 };
  return {
    delay: HOME_ARRIVAL.chromeStartMs / 1000,
    duration: HOME_ARRIVAL.restDurationMs / 1000,
    ease: cueboxEase,
  };
}
