import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FileUpload } from "@/components/file-upload";

const toastMock = vi.fn();

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

describe("FileUpload", () => {
  it("shows a destructive toast when a non-CSV file is selected", () => {
    const onFileSelect = vi.fn();
    render(<FileUpload onFileSelect={onFileSelect} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["bad"], "notes.txt", { type: "text/plain" });

    fireEvent.change(input, { target: { files: [file] } });

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "destructive",
        title: "Invalid file type",
      }),
    );
    expect(onFileSelect).not.toHaveBeenCalled();
  });

  it("clears the displayed filename when selectedFile becomes null", () => {
    const file = new File(["csv"], "watchlist.csv", { type: "text/csv" });
    const { rerender } = render(
      <FileUpload onFileSelect={vi.fn()} selectedFile={file} />,
    );

    expect(screen.getByText(/selected: watchlist\.csv/i)).toBeInTheDocument();

    rerender(<FileUpload onFileSelect={vi.fn()} selectedFile={null} />);

    expect(screen.queryByText(/selected:/i)).not.toBeInTheDocument();
  });
});
