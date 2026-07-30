type ScrollBlock = ScrollLogicalPosition;

/** Scroll a focused field into view above sticky chrome / soft keyboard. */
export function scrollFieldIntoView(
  el: HTMLElement | null | undefined,
  block: ScrollBlock = "center",
): void {
  el?.scrollIntoView({ block });
}
