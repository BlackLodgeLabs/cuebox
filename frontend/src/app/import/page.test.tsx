import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ImportPage from "@/app/import/page";
import { ApiClientError } from "@/lib/api-client";
import { createQueryWrapper } from "@/test/query-wrapper";

const pushMock = vi.fn();
const mutateAsyncMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/hooks/use-import", () => ({
  useImportUpload: () => ({
    mutateAsync: mutateAsyncMock,
    isPending: false,
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

function renderImportPage() {
  const { Wrapper } = createQueryWrapper();
  return render(
    <Wrapper>
      <ImportPage />
    </Wrapper>,
  );
}

describe("ImportPage", () => {
  afterEach(() => {
    cleanup();
    pushMock.mockReset();
    mutateAsyncMock.mockReset();
  });

  it("uses compact upload and ≥44px Start import", () => {
    renderImportPage();

    expect(screen.getByText(/tap to choose a csv/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /choose file/i }).className).toMatch(
      /min-h-11/,
    );
    expect(screen.getByRole("button", { name: /start import/i }).className).toMatch(
      /min-h-11/,
    );
  });

  it("shows reach copy and retry when upload cannot reach the API", async () => {
    mutateAsyncMock.mockRejectedValue(new TypeError("Failed to fetch"));
    renderImportPage();

    const file = new File(["csv"], "watchlist.csv", { type: "text/csv" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    fireEvent.click(screen.getByRole("button", { name: /start import/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/could not reach the api\. make sure the backend is running/i),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("shows coded API errors via getErrorMessage", async () => {
    mutateAsyncMock.mockRejectedValue(
      new ApiClientError({
        code: "VALIDATION_ERROR",
        message: "Invalid CSV",
      }),
    );
    renderImportPage();

    const file = new File(["csv"], "watchlist.csv", { type: "text/csv" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: /start import/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });
});
