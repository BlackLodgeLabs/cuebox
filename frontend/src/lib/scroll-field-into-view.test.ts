import { describe, expect, it, vi } from "vitest";
import { scrollFieldIntoView } from "@/lib/scroll-field-into-view";

describe("scrollFieldIntoView", () => {
  it("defaults to block center", () => {
    const el = document.createElement("input");
    const scrollIntoView = vi.fn();
    el.scrollIntoView = scrollIntoView;

    scrollFieldIntoView(el);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "center" });
  });

  it("accepts block start for search/header alignment", () => {
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
