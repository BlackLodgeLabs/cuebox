"use client";

import { createContext, useContext, useEffect, useState } from "react";

const SetTabBar = createContext<(visible: boolean | null) => void>(() => {});
const TabBarOverride = createContext<boolean | null>(null);

export function ChromeOverrideProvider({ children }: { children: React.ReactNode }) {
  const [tabBar, setTabBar] = useState<boolean | null>(null);
  return (
    <SetTabBar.Provider value={setTabBar}>
      <TabBarOverride.Provider value={tabBar}>{children}</TabBarOverride.Provider>
    </SetTabBar.Provider>
  );
}

/** Null until a screen asks. True forces the tab bar on during the questionnaire route. */
export function useTabBarOverride(): boolean | null {
  return useContext(TabBarOverride);
}

export function useHoldTabBar(visible: boolean): void {
  const setTabBar = useContext(SetTabBar);
  useEffect(() => {
    setTabBar(visible);
    return () => setTabBar(null);
  }, [setTabBar, visible]);
}
