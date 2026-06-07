/**
 * Base API client for Cuebox backend.
 */

import type { ErrorResponse, HealthResponse } from "@/types/api";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export class ApiClientError extends Error {
  readonly code: string;
  readonly details: ErrorResponse["error"]["details"];

  constructor(error: ErrorResponse["error"]) {
    super(error.message);
    this.name = "ApiClientError";
    this.code = error.code;
    this.details = error.details;
  }
}

export async function fetchApi<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    let body: ErrorResponse | undefined;
    try {
      body = (await response.json()) as ErrorResponse;
    } catch {
      throw new Error(
        `API request failed: ${response.status} ${response.statusText}`,
      );
    }

    if (body?.error) {
      throw new ApiClientError(body.error);
    }

    throw new Error(
      `API request failed: ${response.status} ${response.statusText}`,
    );
  }

  return response.json() as Promise<T>;
}

export function getHealth(): Promise<HealthResponse> {
  return fetchApi<HealthResponse>("/health");
}
