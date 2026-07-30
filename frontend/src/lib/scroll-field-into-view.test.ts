import { afterEach, describe, expect, it, vi } from "vitest";
import {
  scrollFieldIntoView,
  scrollSearchFieldToTop,
} from "@/lib/scroll-field-into-view";

describe("scrollFieldIntoView", () => {
  it("defaults to block center", () => {
    const el = document.createElement("input");
    const scrollIntoView = vi.fn();
    el.scrollIntoView = scrollIntoView;

    scrollFieldIntoView(el);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "center" });
  });

  it("accepts an explicit block", () => {
    const el = document.createElement("input");
    const scrollIntoView = vi.fn();
    el.scrollIntoView = scrollIntoView;

    scrollFieldIntoView(el, "start");
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "start" });
  });

  it("no-ops for null", () => {
    expect(() => scrollFieldIntoView(null)).not.toThrow();
  });
});

describe("scrollSearchFieldToTop", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("scrolls so the field sits under the sticky header", () => {
    const header = document.createElement("header");
    header.className = "sticky top-0";
    document.body.appendChild(header);
    header.getBoundingClientRect = () =>
      ({
        top: 0,
        bottom: 56,
        left: 0,
        right: 390,
        width: 390,
        height: 56,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;

    const el = document.createElement("input");
    document.body.appendChild(el);
    el.getBoundingClientRect = () =>
      ({
        top: 220,
        bottom: 264,
        left: 16,
        right: 374,
        width: 358,
        height: 44,
        x: 16,
        y: 220,
        toJSON: () => ({}),
      }) as DOMRect;

    const scrollBy = vi.spyOn(window, "scrollBy").mockImplementation(() => {});

    scrollSearchFieldToTop(el);

    expect(scrollBy).toHaveBeenCalledWith({
      top: 164,
      left: 0,
      behavior: "auto",
    });
  });

  it("no-ops for null", () => {
    expect(() => scrollSearchFieldToTop(null)).not.toThrow();
  });
});
