"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  armCeremonyGate,
  buildStageHref,
  clearCeremonyGate,
  parseStage,
  shouldCoerceToStage3,
  type CeremonyStage,
} from "@/lib/ceremony-gate";

export function useCeremonyNavigation(sessionId: string) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const stage = parseStage(searchParams.get("stage"));

  useEffect(() => {
    if (shouldCoerceToStage3(stage, sessionId)) {
      router.replace(buildStageHref(pathname, 3, searchParams));
      return;
    }
    if (stage === 3) {
      clearCeremonyGate(sessionId);
    }
  }, [stage, sessionId, pathname, router, searchParams]);

  const goNext = () => {
    if (stage === 1) {
      router.push(buildStageHref(pathname, 2, searchParams));
      return;
    }
    if (stage === 2) {
      router.replace(buildStageHref(pathname, 3, searchParams));
    }
  };

  const replay = () => {
    armCeremonyGate(sessionId);
    router.push(buildStageHref(pathname, 1, searchParams));
  };

  return {
    stage: stage as CeremonyStage,
    goNext,
    replay,
    pathname,
    searchParams,
  };
}
