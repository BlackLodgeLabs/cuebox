export type ErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INVALID_CSV_FORMAT"
  | "WATCHLIST_SIZE_EXCEEDED"
  | "NO_PREFERENCE_CONFLICT"
  | "ENRICHMENT_NOT_READY"
  | "INSUFFICIENT_CANDIDATES"
  | "PROVIDER_ERROR"
  | "INTERNAL_ERROR";

export interface ErrorDetail {
  field: string;
  message: string;
}

export interface ErrorBody {
  code: ErrorCode;
  message: string;
  details?: ErrorDetail[] | null;
}

export interface ErrorResponse {
  error: ErrorBody;
}

export type HealthStatus = "ok" | "error";

export interface HealthProviders {
  embedding: HealthStatus;
  semantic_enrichment: HealthStatus;
  ranking: HealthStatus;
}

export interface HealthResponse {
  status: "ok";
  database: HealthStatus;
  providers: HealthProviders;
  version: string;
}
