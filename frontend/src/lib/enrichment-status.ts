const ENRICHMENT_LABELS: Record<string, string> = {
  pending: "Pending",
  matching: "Matching",
  review_required: "Review required",
  enriching: "Enriching",
  ready: "Ready",
  failed: "Failed",
};

export function formatEnrichmentStatus(status: string): string {
  return ENRICHMENT_LABELS[status] ?? status.replaceAll("_", " ");
}
