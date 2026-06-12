import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SyncSettingsPage from "@/app/settings/sync/page";

const rssStatusState = vi.hoisted(() => ({
  username: undefined as string | undefined,
}));

vi.mock("@/hooks/use-sync", () => ({
  useSyncCsv: () => ({ mutateAsync: vi.fn(), isPending: false }),
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
});
