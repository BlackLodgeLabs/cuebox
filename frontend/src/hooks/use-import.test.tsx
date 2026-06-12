import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createQueryWrapper } from "@/test/query-wrapper";
import { useImportStatus } from "@/hooks/use-import";

const { getImportStatusMock } = vi.hoisted(() => ({
  getImportStatusMock: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({
  getImportStatus: getImportStatusMock,
  postImport: vi.fn(),
}));

describe("useImportStatus", () => {
  it("invalidates films cache when import completes", async () => {
    getImportStatusMock.mockResolvedValue({
      job_id: "job-1",
      status: "complete",
      processed_films: 2,
      failed_films: 0,
      duplicate_films: 0,
      total_films: 2,
      failure_summary: null,
    });

    const { Wrapper, invalidateQueries } = createQueryWrapper();
    const { result } = renderHook(() => useImportStatus("job-1"), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.data?.status).toBe("complete");
    });

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["films"] });
  });
});
