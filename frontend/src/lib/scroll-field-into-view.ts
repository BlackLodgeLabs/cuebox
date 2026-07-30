/** Scroll a focused field into view above sticky chrome / soft keyboard. */
export function scrollFieldIntoView(el: HTMLElement | null | undefined): void {
  el?.scrollIntoView({ block: "center" });
}
