import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  HISTORY_PAGE_SIZE,
  INFINITE_SCROLL_TRIGGER_PX,
  WATCHLIST_PAGE_SIZE,
  useInfiniteScroll,
  type InfinitePage,
} from "@/hooks/use-infinite-scroll";
import { createQueryWrapper } from "@/test/query-wrapper";

function page(offset: number, hasMore: boolean, count: number): InfinitePage<{ id: string }> {
  return {
    data: Array.from({ length: count }, (_, index) => ({
      id: `film-${offset + index}`,
    })),
    pagination: { has_more: hasMore, total: 40, limit: count, offset },
  };
}

function setDistance(remainingPx: number) {
  const viewport = 800;
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: viewport,
  });
  Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
  Object.defineProperty(document.documentElement, "scrollHeight", {
    configurable: true,
    value: viewport + remainingPx,
  });
}

describe("useInfiniteScroll", () => {
  afterEach(() => {
    document.documentElement.style.removeProperty("--cb-watchlist-trigger-px");
  });

  it("uses the locked page sizes and a 600px trigger", () => {
    expect(WATCHLIST_PAGE_SIZE).toBe(18);
    expect(HISTORY_PAGE_SIZE).toBe(10);
    expect(INFINITE_SCROLL_TRIGGER_PX).toBe(600);
  });

  it("fetches the next page at 600px from the bottom and not before", async () => {
    setDistance(601);
    const fetchPage = vi.fn(async ({ offset, limit }: { offset: number; limit: number }) => {
      if (offset === 0) return page(0, true, limit);
      return page(offset, false, limit);
    });
    const { Wrapper } = createQueryWrapper();

    renderHook(
      () =>
        useInfiniteScroll({
          queryKey: ["watchlist", "boundary"],
          pageSize: WATCHLIST_PAGE_SIZE,
          fetchPage,
        }),
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(1));
    expect(fetchPage).toHaveBeenCalledWith({ offset: 0, limit: 18 });

    setDistance(600);
    window.dispatchEvent(new Event("scroll"));

    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(2));
    expect(fetchPage).toHaveBeenLastCalledWith({ offset: 18, limit: 18 });
  });

  it("stops when has_more is false and does not start a second fetch while one is in flight", async () => {
    setDistance(100);
    let releaseSecond: (value: InfinitePage<{ id: string }>) => void = () => undefined;
    const fetchPage = vi.fn(({ offset, limit }: { offset: number; limit: number }) => {
      if (offset === 0) return Promise.resolve(page(0, true, limit));
      return new Promise<InfinitePage<{ id: string }>>((resolve) => {
        releaseSecond = resolve;
      });
    });
    const { Wrapper } = createQueryWrapper();

    const { result } = renderHook(
      () =>
        useInfiniteScroll({
          queryKey: ["history", "dedupe"],
          pageSize: HISTORY_PAGE_SIZE,
          fetchPage,
        }),
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(2));
    expect(fetchPage).toHaveBeenLastCalledWith({ offset: 10, limit: 10 });

    window.dispatchEvent(new Event("scroll"));
    window.dispatchEvent(new Event("scroll"));
    expect(fetchPage).toHaveBeenCalledTimes(2);

    releaseSecond(page(10, false, 10));
    await waitFor(() => expect(result.current.hasMore).toBe(false));

    window.dispatchEvent(new Event("scroll"));
    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(result.current.items).toHaveLength(20);
  });
});
