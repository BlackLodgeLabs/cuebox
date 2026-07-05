import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WatchProviderIcons } from "@/components/watch-provider-icons";

vi.mock("next/image", () => ({
  default: () => <div>logo</div>,
}));

const categories = [
  {
    type: "flatrate" as const,
    providers: [
      {
        provider_id: 8,
        provider_name: "Netflix",
        logo_url: "https://image.tmdb.org/t/p/w92/netflix.jpg",
        display_priority: 1,
      },
    ],
  },
  {
    type: "rent" as const,
    providers: [
      {
        provider_id: 8,
        provider_name: "Netflix",
        logo_url: "https://image.tmdb.org/t/p/w92/netflix.jpg",
        display_priority: 2,
      },
      {
        provider_id: 2,
        provider_name: "Apple TV",
        logo_url: "https://image.tmdb.org/t/p/w92/apple.jpg",
        display_priority: 3,
      },
    ],
  },
  {
    type: "buy" as const,
    providers: Array.from({ length: 6 }, (_, index) => ({
      provider_id: 100 + index,
      provider_name: `Provider ${index}`,
      logo_url: `https://image.tmdb.org/t/p/w92/p${index}.jpg`,
      display_priority: index,
    })),
  },
];

describe("WatchProviderIcons", () => {
  afterEach(() => {
    cleanup();
  });

  it("dedupes providers across categories preferring flatrate order", () => {
    render(<WatchProviderIcons categories={categories.slice(0, 2)} />);

    expect(screen.getAllByLabelText("Netflix")).toHaveLength(1);
    expect(screen.getByLabelText("Apple TV")).toBeInTheDocument();
  });

  it("caps visible icons and shows overflow badge", () => {
    render(<WatchProviderIcons categories={categories} />);

    expect(screen.getByText("+2")).toBeInTheDocument();
    expect(screen.getAllByText("logo").length).toBeLessThanOrEqual(6);
  });

  it("omits output when no providers are available", () => {
    const { container } = render(<WatchProviderIcons categories={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
