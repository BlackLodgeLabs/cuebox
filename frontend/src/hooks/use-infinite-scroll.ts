"use client";

import { useInfiniteQuery, type QueryKey } from "@tanstack/react-query";
import { useEffect } from "react";
import { readCssNumber } from "@/lib/motion";

export const INFINITE_SCROLL_TRIGGER_PX = 600;
export const WATCHLIST_PAGE_SIZE = 18;
export const HISTORY_PAGE_SIZE = 10;

export type InfinitePage<T> = {
  data: T[];
  pagination: {
    has_more: boolean;
    total?: number;
    limit?: number;
    offset?: number;
  };
};

type UseInfiniteScrollOptions<T> = {
  queryKey: QueryKey;
  pageSize: number;
  fetchPage: (args: { offset: number; limit: number }) => Promise<InfinitePage<T>>;
  enabled?: boolean;
};

function distanceFromBottom(): number {
  const scrolling = document.scrollingElement ?? document.documentElement;
  const scrollY = window.scrollY || scrolling.scrollTop || 0;
  return scrolling.scrollHeight - scrollY - window.innerHeight;
}

export function useInfiniteScroll<T>({
  queryKey,
  pageSize,
  fetchPage,
  enabled = true,
}: UseInfiniteScrollOptions<T>) {
  const query = useInfiniteQuery({
    queryKey: [...queryKey, pageSize],
    enabled,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchPage({ offset: pageParam, limit: pageSize }),
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.pagination.has_more) return undefined;
      if (lastPage.data.length === 0) return undefined;
      return allPages.reduce((count, page) => count + page.data.length, 0);
    },
  });

  const { hasNextPage, isFetchingNextPage, isSuccess, fetchNextPage } = query;

  useEffect(() => {
    if (!enabled || !isSuccess) return;

    let locked = false;

    const maybeFetch = () => {
      if (locked || !hasNextPage || isFetchingNextPage) return;
      const triggerPx = readCssNumber(
        "--cb-watchlist-trigger-px",
        INFINITE_SCROLL_TRIGGER_PX,
      );
      if (distanceFromBottom() > triggerPx) return;
      locked = true;
      void fetchNextPage().finally(() => {
        locked = false;
      });
    };

    maybeFetch();
    window.addEventListener("scroll", maybeFetch, { passive: true });
    window.addEventListener("resize", maybeFetch);
    return () => {
      window.removeEventListener("scroll", maybeFetch);
      window.removeEventListener("resize", maybeFetch);
    };
  }, [enabled, isSuccess, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const pages = query.data?.pages ?? [];

  return {
    items: pages.flatMap((page) => page.data),
    hasMore: hasNextPage,
    isLoading: query.isLoading,
    isFetchingNextPage,
    isError: query.isError,
    error: query.error,
    fetchNextPage,
    refetch: query.refetch,
  };
}
