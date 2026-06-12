"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";
import { useDevModeEnabled } from "@/hooks/use-dev-mode";

interface DevModeContextValue {
  isEnabled: boolean;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

const DevModeContext = createContext<DevModeContextValue | null>(null);

export function DevModeProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const { data: isEnabled = false } = useDevModeEnabled();
  const [isOpen, setOpen] = useState(false);

  useEffect(() => {
    if (isEnabled && searchParams.get("dev") === "1") {
      setOpen(true);
    }
  }, [isEnabled, searchParams]);

  useEffect(() => {
    if (!isEnabled) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === "d" && event.shiftKey && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isEnabled]);

  const toggle = useCallback(() => {
    setOpen((current) => !current);
  }, []);

  const value = useMemo(
    () => ({
      isEnabled,
      isOpen,
      setOpen,
      toggle,
    }),
    [isEnabled, isOpen, toggle],
  );

  return (
    <DevModeContext.Provider value={value}>{children}</DevModeContext.Provider>
  );
}

export function useDevMode() {
  const context = useContext(DevModeContext);
  if (!context) {
    throw new Error("useDevMode must be used within DevModeProvider");
  }
  return context;
}
