import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomeArrivalProvider } from "@/components/home-arrival";

const navigation = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
}));

function mockMotion(reduced: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduced && query.includes("reduce"),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

describe("home arrival", () => {
  afterEach(() => {
    cleanup();
    navigation.pathname = "/";
    vi.unstubAllGlobals();
  });

  it("skips the splash when reduced motion is requested", () => {
    mockMotion(true);
    render(
      <HomeArrivalProvider>
        <p>Settled home</p>
      </HomeArrivalProvider>,
    );

    expect(screen.getByText("Settled home")).toBeInTheDocument();
    expect(screen.queryByTestId("home-arrival-splash")).not.toBeInTheDocument();
  });

  it("plays the option-E splash on a cold home load", () => {
    mockMotion(false);
    render(
      <HomeArrivalProvider>
        <p>Home</p>
      </HomeArrivalProvider>,
    );

    const splash = screen.getByTestId("home-arrival-splash");
    expect(splash).toHaveAttribute("data-logo-wall-ms", "2035");
    expect(splash).toHaveAttribute("data-wordmark-lock-ms", "1894");
    expect(splash).toHaveAttribute("data-iris-start-ms", "1974");
    expect(splash).toHaveAttribute("data-iris-duration-ms", "760");
    expect(splash).toHaveAttribute("data-iris-ease", "0.42,0,0.58,1");
    expect(splash).toHaveAttribute("data-soft-edge-from", "1.25");
    expect(splash).toHaveAttribute("data-soft-edge-to", "12");
    expect(splash).toHaveAttribute("data-wordmark-fade-ms", "600");
    expect(splash).toHaveAttribute("data-chrome-start-ms", "2674");
    expect(splash).toHaveAttribute("data-rest-start-ms", "2734");
    expect(splash).toHaveAttribute("data-rest-rise-px", "6");
    expect(splash).toHaveAttribute("data-rest-stagger-ms", "70");
  });

  it("does not replay the splash when a later visit returns to Home", () => {
    mockMotion(false);
    navigation.pathname = "/watchlist";
    const { rerender } = render(
      <HomeArrivalProvider>
        <p>Elsewhere</p>
      </HomeArrivalProvider>,
    );
    expect(screen.queryByTestId("home-arrival-splash")).not.toBeInTheDocument();

    navigation.pathname = "/";
    rerender(
      <HomeArrivalProvider>
        <p>Home</p>
      </HomeArrivalProvider>,
    );
    expect(screen.queryByTestId("home-arrival-splash")).not.toBeInTheDocument();
  });
});
