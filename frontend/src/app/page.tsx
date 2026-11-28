"use client";

import { Suspense } from "react";
import { HomeScreen } from "@/components/home-screen";

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-[70svh] animate-pulse bg-cb-surface" />}>
      <HomeScreen />
    </Suspense>
  );
}
