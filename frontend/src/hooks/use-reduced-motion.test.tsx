import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

function Probe() {
  const reduced = useReducedMotion();
  return <span>{reduced ? "reduced" : "full"}</span>;
}

function installMatchMedia(initial: boolean) {
  let matches = initial;
  const listeners = new Set<() => void>();
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    get matches() {
      return query.includes("prefers-reduced-motion") ? matches : false;
    },
    media: query,
    addEventListener: (_event: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_event: string, listener: () => void) => listeners.delete(listener),
  }));
  return {
    setMatches(next: boolean) {
      matches = next;
      listeners.forEach((listener) => listener());
    },
  };
}

describe("useReducedMotion", () => {
  afterEach(() => {
    cleanup();
    delete (window as { matchMedia?: unknown }).matchMedia;
  });

  it("follows a mocked prefers-reduced-motion query", async () => {
    const media = installMatchMedia(true);
    render(<Probe />);
    expect(await screen.findByText("reduced")).toBeInTheDocument();

    media.setMatches(false);
    await waitFor(() => expect(screen.getByText("full")).toBeInTheDocument());
  });

  it("stays on full motion when matchMedia is missing", () => {
    delete (window as { matchMedia?: unknown }).matchMedia;
    render(<Probe />);
    expect(screen.getByText("full")).toBeInTheDocument();
  });
});
