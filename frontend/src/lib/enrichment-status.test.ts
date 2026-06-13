import { describe, expect, it } from "vitest";
import { formatEnrichmentStatus } from "@/lib/enrichment-status";

describe("formatEnrichmentStatus", () => {
  it("maps known statuses to readable labels", () => {
    expect(formatEnrichmentStatus("review_required")).toBe("Review required");
    expect(formatEnrichmentStatus("ready")).toBe("Ready");
  });

  it("falls back for unknown statuses", () => {
    expect(formatEnrichmentStatus("custom_status")).toBe("custom status");
  });
});
