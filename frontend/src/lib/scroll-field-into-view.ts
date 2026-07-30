type ScrollBlock = ScrollLogicalPosition;

/** Scroll a focused field into view above sticky chrome / soft keyboard. */
export function scrollFieldIntoView(
  el: HTMLElement | null | undefined,
  block: ScrollBlock = "center",
): void {
  el?.scrollIntoView({ block });
}

const STICKY_HEADER_SELECTOR = "header.sticky";

/**
 * Pin a search field just under the sticky app header so page intro/helper
 * text scrolls away — leaving header, input, results, and keyboard room.
 * Retries after focus/keyboard to beat iOS Safari's visual-viewport re-center.
 */
export function scrollSearchFieldToTop(
  el: HTMLElement | null | undefined,
): void {
  if (!el || typeof window === "undefined") return;

  const align = () => {
    const header = document.querySelector(STICKY_HEADER_SELECTOR);
    const headerBottom = header?.getBoundingClientRect().bottom ?? 0;
    const delta = el.getBoundingClientRect().top - headerBottom;
    if (Math.abs(delta) > 1) {
      window.scrollBy({ top: delta, left: 0, behavior: "auto" });
    }
  };

  align();
  requestAnimationFrame(() => {
    align();
    window.setTimeout(align, 100);
    window.setTimeout(align, 350);
  });

  const vv = window.visualViewport;
  if (!vv) return;

  const onViewportChange = () => align();
  vv.addEventListener("resize", onViewportChange);
  vv.addEventListener("scroll", onViewportChange);
  window.setTimeout(() => {
    vv.removeEventListener("resize", onViewportChange);
    vv.removeEventListener("scroll", onViewportChange);
  }, 600);
}
