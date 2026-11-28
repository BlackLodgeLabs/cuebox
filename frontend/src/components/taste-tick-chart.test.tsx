import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TasteTickChart } from "@/components/taste-tick-chart";

const reduced = vi.hoisted(() => ({ current: false }));

vi.mock("@/hooks/use-reduced-motion", () => ({
  useReducedMotion: () => reduced.current,
}));

class FakeObserver {
  static instances: FakeObserver[] = [];
  callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    FakeObserver.instances.push(this);
  }

  observe() {}
  unobserve() {}
  disconnect() {}

  trigger(ratio: number) {
    this.callback(
      [
        {
          intersectionRatio: ratio,
          isIntersecting: ratio > 0,
        } as IntersectionObserverEntry,
      ],
      this as unknown as IntersectionObserver,
    );
  }
}

describe("TasteTickChart", () => {
  afterEach(() => {
    cleanup();
    reduced.current = false;
    FakeObserver.instances = [];
  });

  it("waits until 40% of the chart is in view, then staggers ticks with no glow", () => {
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    render(
      <TasteTickChart
        scores={{ pacing: 3.5, complexity: 6.5, energy: null, obscurity: null }}
      />,
    );

    const chart = screen.getByTestId("taste-ticks");
    expect(chart).toHaveAttribute("data-glow", "off");
    expect(chart).toHaveAttribute("data-trigger", "0.4");
    expect(chart).toHaveAttribute("data-playing", "false");
    expect(chart.querySelector("[style*='drop-shadow']")).toBeNull();

    act(() => {
      FakeObserver.instances.at(-1)?.trigger(0.39);
    });
    expect(chart).toHaveAttribute("data-playing", "false");

    act(() => {
      FakeObserver.instances.at(-1)?.trigger(0.4);
    });
    expect(chart).toHaveAttribute("data-playing", "true");

    const pacing = screen.getByLabelText("Pacing 3.5 of 10");
    const pacingDelays = [...pacing.querySelectorAll("[data-delay-ms]")].map((node) =>
      node.getAttribute("data-delay-ms"),
    );
    expect(pacingDelays).toEqual(["0", "70", "140", "210"]);

    const complexity = screen.getByLabelText("Complexity 6.5 of 10");
    const firstComplexity = complexity.querySelector("[data-delay-ms]");
    expect(firstComplexity).toHaveAttribute("data-delay-ms", "90");
    expect(firstComplexity).toHaveAttribute("data-fill-ms", "330");
  });

  it("fades finished ticks together over 300ms when motion is reduced", () => {
    reduced.current = true;
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    render(
      <TasteTickChart
        scores={{ pacing: 3.5, complexity: null, energy: null, obscurity: null }}
      />,
    );

    const chart = screen.getByTestId("taste-ticks");
    expect(chart).toHaveAttribute("data-reduced", "true");
    expect(chart).toHaveAttribute("data-fade-together", "true");
    expect(chart).toHaveAttribute("data-glow", "off");

    act(() => {
      FakeObserver.instances.at(-1)?.trigger(0.39);
    });
    expect(chart).toHaveAttribute("data-playing", "false");

    act(() => {
      FakeObserver.instances.at(-1)?.trigger(0.4);
    });
    expect(chart).toHaveAttribute("data-playing", "true");

    const delays = [...chart.querySelectorAll("[data-delay-ms]")].map((node) =>
      node.getAttribute("data-delay-ms"),
    );
    expect(delays.length).toBeGreaterThan(0);
    expect(new Set(delays)).toEqual(new Set(["0"]));
    for (const node of chart.querySelectorAll("[data-fill-ms]")) {
      expect(node).toHaveAttribute("data-fill-ms", "300");
    }
  });
});
