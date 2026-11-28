import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/app-shell";
import { DeleteHistoryDialog } from "@/components/delete-history-dialog";
import { CueNumber } from "@/components/ui/cue-number";
import { LoadingMore } from "@/components/ui/infinite-scroll";
import { Reveal } from "@/components/ui/reveal";
import { SearchCard } from "@/components/ui/search-card";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Toaster, toast } from "@/components/ui/sonner";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

function mockReduced(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    get matches() {
      return query.includes("prefers-reduced-motion") ? matches : false;
    },
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

describe("shared motion kit", () => {
  afterEach(() => {
    cleanup();
    delete (window as { matchMedia?: unknown }).matchMedia;
  });

  it("opens a bottom sheet for 800ms with a 120px dismiss and a 55% dim", () => {
    mockReduced(false);
    render(
      <Sheet open>
        <SheetContent side="bottom">
          <SheetTitle>Filter and sort</SheetTitle>
        </SheetContent>
      </Sheet>,
    );

    const dialog = screen.getByRole("dialog", { name: "Filter and sort" });
    expect(dialog).toHaveAttribute("data-vaul-drawer-direction", "bottom");
    expect(dialog).toHaveAttribute("data-open-ms", "800");
    expect(dialog).toHaveAttribute("data-close-ms", "700");
    expect(dialog).toHaveAttribute("data-dismiss-px", "120");
    expect(dialog).toHaveAttribute("data-travel", "y");
    expect(dialog.querySelector("[data-vaul-handle]")).not.toBeNull();
    expect(document.querySelector("[data-cb-sheet-overlay]")).toHaveAttribute("data-dim", "0.55");
  });

  it("fades the sheet with no travel when reduced motion is on", async () => {
    mockReduced(true);
    render(
      <Sheet open>
        <SheetContent side="bottom">
          <SheetTitle>Filter history</SheetTitle>
        </SheetContent>
      </Sheet>,
    );

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Filter history" })).toHaveAttribute(
        "data-travel",
        "none",
      );
    });
    const dialog = screen.getByRole("dialog", { name: "Filter history" });
    expect(dialog).toHaveAttribute("data-open-ms", "300");
    expect(dialog).toHaveAttribute("data-close-ms", "300");
    expect(dialog).toHaveAttribute("data-cb-reduced", "true");
  });

  it("confirms history removal from 92% scale with a danger button", () => {
    mockReduced(false);
    render(
      <DeleteHistoryDialog
        open
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
        isPending={false}
      />,
    );

    const dialog = screen.getByRole("alertdialog", { name: "Remove this night?" });
    expect(dialog).toHaveAttribute("data-duration-ms", "400");
    expect(dialog).toHaveAttribute("data-from-scale", "0.92");
    expect(dialog).toHaveAttribute("data-travel", "scale");
    const confirm = screen.getByRole("button", { name: "Remove" });
    expect(confirm.className).toContain("bg-cb-danger");
    expect(confirm.className).not.toContain("shadow-glow");
  });

  it("fades the confirm with no scale when reduced motion is on", async () => {
    mockReduced(true);
    render(
      <DeleteHistoryDialog
        open
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
        isPending={false}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("alertdialog")).toHaveAttribute("data-travel", "none");
    });
    expect(screen.getByRole("alertdialog")).toHaveAttribute("data-from-scale", "1");
    expect(screen.getByRole("alertdialog")).toHaveAttribute("data-duration-ms", "300");
  });

  it("opens the search card from 96% over 700ms", async () => {
    mockReduced(false);
    const user = userEvent.setup();
    render(
      <AppShell>
        <p>Home</p>
      </AppShell>,
    );

    expect(document.querySelector("[data-cb-screen]")).toHaveAttribute("data-fade-ms", "400");
    await user.click(screen.getByRole("textbox", { name: "Search films" }));

    const card = screen.getByRole("dialog", { name: "Search films" });
    expect(card).toHaveAttribute("data-open-ms", "700");
    expect(card).toHaveAttribute("data-close-ms", "600");
    expect(card).toHaveAttribute("data-from-scale", "0.96");
    expect(card).toHaveAttribute("data-travel", "scale");
  });

  it("drops search scale under reduced motion", async () => {
    mockReduced(true);
    render(<SearchCard open onOpenChange={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Search films" })).toHaveAttribute(
        "data-travel",
        "none",
      );
    });
    expect(screen.getByRole("dialog", { name: "Search films" })).toHaveAttribute(
      "data-from-scale",
      "1",
    );
  });

  it("shows a toast for 2800ms that travels 20px and has no undo", async () => {
    mockReduced(false);
    render(<Toaster />);
    toast({ title: "Added to watchlist", description: "Heat is on your watchlist." });

    expect(await screen.findByText("Added to watchlist")).toBeInTheDocument();
    const toaster = document.querySelector("[data-sonner-toaster]");
    expect(toaster).not.toBeNull();
    expect(toaster?.getAttribute("style") ?? "").toContain("--cb-toast-travel: 20px");
    expect(toaster?.getAttribute("style") ?? "").toContain("--cb-toast-in: 700ms");
    expect(toaster?.getAttribute("style") ?? "").toContain("--cb-toast-out: 600ms");
    expect(toaster?.getAttribute("style") ?? "").toContain("--cb-toast-stay: 2800ms");
    expect(screen.queryByRole("button", { name: /undo/i })).not.toBeInTheDocument();
  });

  it("fades a toast in place under reduced motion", async () => {
    mockReduced(true);
    render(<Toaster />);
    await waitFor(() => {
      toast({ title: "Saved" });
    });
    await screen.findByText("Saved");
    await waitFor(() => {
      const toaster = document.querySelector("[data-sonner-toaster]");
      expect(toaster?.className ?? "").toContain("cb-toaster-reduced");
      expect(toaster?.getAttribute("style") ?? "").toContain("--cb-toast-travel: 0px");
    });
  });

  it("shows the settled number under reduced motion", async () => {
    mockReduced(true);
    render(<CueNumber value={18} />);
    await waitFor(() => {
      expect(screen.getByText("18").closest("[data-cb-number]")).toHaveAttribute(
        "data-settled",
        "true",
      );
    });
    expect(document.querySelector("number-flow")).toBeNull();
  });

  it("reveals with height, and fades only when motion is reduced", async () => {
    mockReduced(false);
    render(
      <Reveal open>
        <p>Full synopsis</p>
      </Reveal>,
    );
    expect(screen.getByText("Full synopsis").parentElement).toHaveAttribute("data-travel", "height");
    expect(screen.getByText("Full synopsis").parentElement).toHaveAttribute("data-duration-ms", "300");
  });

  it("fades a reveal without height travel when reduced motion is on", async () => {
    mockReduced(true);
    render(
      <Reveal open>
        <p>Full synopsis</p>
      </Reveal>,
    );
    await waitFor(() => {
      expect(screen.getByText("Full synopsis").parentElement).toHaveAttribute("data-travel", "none");
    });
  });

  it("shows a flat teal loading-more spinner", () => {
    render(<LoadingMore />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Loading more");
    expect(status.className).toContain("text-cb-teal");
    expect(status.className).not.toMatch(/shadow|glow/);
  });
});
