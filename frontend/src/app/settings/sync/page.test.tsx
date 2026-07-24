import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SyncSettingsPage from "@/app/settings/sync/page";

const rssStatusState = vi.hoisted(() => ({
  username: undefined as string | undefined,
}));

const syncWatchedMutate = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-sync", () => ({
  useSyncCsv: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSyncWatched: () => ({
    mutateAsync: syncWatchedMutate,
    isPending: false,
  }),
  useSyncRssConfig: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSyncRssStatus: () => ({
    data: rssStatusState.username
      ? {
          configured: true,
          username: rssStatusState.username,
          polling_interval_seconds: 900,
          last_polled_at: null,
          last_poll_status: null,
          events_processed_last_poll: null,
        }
      : {
          configured: false,
          username: null,
          polling_interval_seconds: 900,
          last_polled_at: null,
          last_poll_status: null,
          events_processed_last_poll: null,
        },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

describe("SyncSettingsPage", () => {
  afterEach(() => {
    cleanup();
    syncWatchedMutate.mockReset();
  });

  it("prefills the RSS username from saved config", async () => {
    rssStatusState.username = "saveduser";
    render(<SyncSettingsPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/letterboxd username/i)).toHaveValue(
        "saveduser",
      );
    });
  });

  it("does not overwrite in-progress typing when RSS status hydrates", async () => {
    rssStatusState.username = undefined;
    const { rerender } = render(<SyncSettingsPage />);

    const input = screen.getByLabelText(/letterboxd username/i);
    fireEvent.change(input, { target: { value: "typing-user" } });
    expect(input).toHaveValue("typing-user");

    rssStatusState.username = "saveduser";
    rerender(<SyncSettingsPage />);

    expect(input).toHaveValue("typing-user");
  });

  it("shows Import watched history card and requires three files", () => {
    rssStatusState.username = undefined;
    render(<SyncSettingsPage />);

    expect(
      screen.getByText(/upload letterboxd.s watched, ratings, and diary/i),
    ).toBeInTheDocument();
    const importButton = screen.getByRole("button", {
      name: /^import watched history$/i,
    });
    expect(importButton).toBeDisabled();
  });

  it("imports when all three files are selected and shows summary", async () => {
    rssStatusState.username = undefined;
    syncWatchedMutate.mockResolvedValue({
      films_seen: 10,
      films_created: 10,
      watches_created: 11,
      watches_skipped_duplicate: 0,
      pending_review: 1,
      enrichment_job_id: "job-1",
      failures: [],
    });
    render(<SyncSettingsPage />);

    const files = [
      new File(["w"], "watched.csv", { type: "text/csv" }),
      new File(["r"], "ratings.csv", { type: "text/csv" }),
      new File(["d"], "diary.csv", { type: "text/csv" }),
    ];
    const inputs = document.querySelectorAll('input[type="file"]');
    expect(inputs.length).toBeGreaterThanOrEqual(4);
    fireEvent.change(inputs[1]!, { target: { files: [files[0]] } });
    fireEvent.change(inputs[2]!, { target: { files: [files[1]] } });
    fireEvent.change(inputs[3]!, { target: { files: [files[2]] } });

    const importButton = screen.getByRole("button", {
      name: /^import watched history$/i,
    });
    await waitFor(() => expect(importButton).not.toBeDisabled());
    fireEvent.click(importButton);

    await waitFor(() => {
      expect(syncWatchedMutate).toHaveBeenCalled();
      expect(screen.getByText(/watched history imported/i)).toBeInTheDocument();
      expect(screen.getByText(/films seen: 10/i)).toBeInTheDocument();
      expect(screen.getByText(/view watched list/i)).toBeInTheDocument();
    });
  });
});
