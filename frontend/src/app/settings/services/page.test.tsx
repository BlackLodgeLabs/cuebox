import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import MyServicesPage from "@/app/settings/services/page";
import { MY_SERVICES_INTRO } from "@/lib/watch-services";
import { createQueryWrapper } from "@/test/query-wrapper";

const push = vi.fn();

const { getStreamingServices, getStreamingCatalog, putStreamingServices } = vi.hoisted(() => ({
  getStreamingServices: vi.fn(),
  getStreamingCatalog: vi.fn(),
  putStreamingServices: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return {
    ...actual,
    getStreamingServices: () => getStreamingServices(),
    getStreamingCatalog: () => getStreamingCatalog(),
    putStreamingServices: (ids: number[]) => putStreamingServices(ids),
  };
});

const catalog = {
  country_code: "GB",
  providers: [
    { provider_id: 8, provider_name: "Netflix", logo_url: null, display_priority: 1 },
    { provider_id: 9, provider_name: "Prime Video", logo_url: null, display_priority: 2 },
    { provider_id: 337, provider_name: "Disney Plus", logo_url: null, display_priority: 3 },
  ],
};

function renderPage() {
  const { Wrapper } = createQueryWrapper();
  return render(
    <Wrapper>
      <MyServicesPage />
    </Wrapper>,
  );
}

describe("MyServicesPage", () => {
  afterEach(() => {
    cleanup();
    push.mockReset();
    getStreamingServices.mockReset();
    getStreamingCatalog.mockReset();
    putStreamingServices.mockReset();
  });

  it("shows the locked intro and saves the teal selection", async () => {
    const user = userEvent.setup();
    getStreamingServices.mockResolvedValue({ country_code: "GB", provider_ids: [8] });
    getStreamingCatalog.mockResolvedValue(catalog);
    putStreamingServices.mockResolvedValue({ country_code: "GB", provider_ids: [8, 9] });
    renderPage();

    expect(await screen.findByText(MY_SERVICES_INTRO)).toBeInTheDocument();
    expect(screen.getByText("United Kingdom")).toBeInTheDocument();
    expect(screen.queryByText(/example set/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/never hides a film/i)).not.toBeInTheDocument();

    const netflix = await screen.findByRole("button", { name: "Netflix", pressed: true });
    expect(netflix).toHaveAttribute("aria-pressed", "true");
    expect(netflix.className).toMatch(/text-cb-teal/);
    expect(netflix.className).not.toMatch(/shadow/);

    await user.click(screen.getByRole("button", { name: "Prime Video" }));
    await user.click(screen.getByRole("button", { name: "Done" }));

    await waitFor(() => {
      expect(putStreamingServices).toHaveBeenCalledWith([8, 9]);
    });
    expect(push).toHaveBeenCalledWith("/more");
  });

  it("shows an error and can retry when the catalog fails", async () => {
    getStreamingServices.mockResolvedValue({ country_code: "GB", provider_ids: [] });
    getStreamingCatalog.mockRejectedValue(new Error("offline"));
    renderPage();

    expect(await screen.findByText("Could not load services")).toBeInTheDocument();
    getStreamingCatalog.mockResolvedValue({ country_code: "GB", providers: [] });
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByText(/No services are listed/i)).toBeInTheDocument();
  });
});
