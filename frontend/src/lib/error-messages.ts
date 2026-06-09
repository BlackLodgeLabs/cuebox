import type { ErrorBody, ErrorCode } from "@/types/api";

const ERROR_MESSAGES: Record<ErrorCode, string> = {
  VALIDATION_ERROR: "Please check your input and try again.",
  NOT_FOUND: "The requested item could not be found.",
  CONFLICT: "This action conflicts with the current state.",
  INVALID_CSV_FORMAT:
    "This file is not a valid Letterboxd watchlist CSV. Export your watchlist from Letterboxd and ensure it includes Date, Title, Year, and Letterboxd URI columns.",
  WATCHLIST_SIZE_EXCEEDED:
    "Your watchlist exceeds the 500-film limit. Remove some films from your Letterboxd watchlist before importing.",
  NO_PREFERENCE_CONFLICT:
    '"No Preference" cannot be combined with other selections. Clear other choices or select only "No Preference".',
  ENRICHMENT_NOT_READY:
    "Some films are still being enriched. Wait for import to finish or check import status.",
  INSUFFICIENT_CANDIDATES:
    "No films in your watchlist match these preferences. Try relaxing your choices or importing more films.",
  PROVIDER_ERROR:
    "An external service failed. Please wait a moment and try again.",
  INTERNAL_ERROR: "Something went wrong on our end. Please try again.",
};

export function getErrorMessage(error: ErrorBody): string {
  if (error.code === "VALIDATION_ERROR" && error.details?.length) {
    return error.details.map((d) => d.message).join(" ");
  }
  return ERROR_MESSAGES[error.code] ?? error.message;
}

export function formatApiError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "An unexpected error occurred.";
}
