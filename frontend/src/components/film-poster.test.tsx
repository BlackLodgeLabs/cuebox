import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FilmPoster } from "@/components/film-poster";

afterEach(() => {
  cleanup();
});

vi.mock("next/image", () => ({
  default: ({
    alt,
    src,
    onError,
    fill,
    width,
    height,
  }: {
    alt: string;
    src?: string;
    onError?: () => void;
    fill?: boolean;
    width?: number;
    height?: number;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={alt}
      src={src}
      onError={onError}
      data-fill={fill ? "true" : undefined}
      data-width={width}
      data-height={height}
    />
  ),
}));

describe("FilmPoster", () => {
  it("shows NO POSTER placeholder when src is null", () => {
    render(<FilmPoster src={null} alt="Missing" />);
    expect(screen.getByText("NO POSTER")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("renders an image when src is valid", () => {
    render(
      <FilmPoster
        src="https://image.tmdb.org/t/p/w500/poster.jpg"
        alt="A Film"
      />,
    );
    const img = screen.getByRole("img", { name: "A Film" });
    expect(img).toHaveAttribute(
      "src",
      "https://image.tmdb.org/t/p/w500/poster.jpg",
    );
    expect(screen.queryByText("NO POSTER")).not.toBeInTheDocument();
  });

  it("shows the same NO POSTER placeholder when the image fails to load", () => {
    render(
      <FilmPoster
        src="https://image.tmdb.org/t/p/w500/broken.jpg"
        alt="Broken"
      />,
    );
    const img = screen.getByRole("img", { name: "Broken" });
    fireEvent.error(img);
    expect(screen.getByText("NO POSTER")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("uses fill layout when size is fill", () => {
    const { container } = render(
      <div className="relative h-40 w-28">
        <FilmPoster
          src="https://image.tmdb.org/t/p/w500/poster.jpg"
          alt="Fill"
          size="fill"
          sizes="200px"
          priority
        />
      </div>,
    );
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("data-fill", "true");
  });
});
