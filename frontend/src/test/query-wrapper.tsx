"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Mock } from "vitest";
import { vi } from "vitest";

export function createQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  return { Wrapper, invalidateQueries: invalidateQueries as Mock };
}
