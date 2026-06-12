import Image from "next/image";

interface FilmPosterProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const SIZES = {
  sm: { width: 80, height: 120, className: "h-[120px] w-[80px]" },
  md: { width: 120, height: 180, className: "h-[180px] w-[120px]" },
  lg: { width: 200, height: 300, className: "h-[300px] w-[200px]" },
};

export function FilmPoster({
  src,
  alt,
  className = "",
  size = "md",
}: FilmPosterProps) {
  const dims = SIZES[size];

  if (!src) {
    return (
      <div
        className={`flex items-center justify-center rounded bg-surface-high text-label-md text-muted-foreground ${dims.className} ${className}`}
      >
        NO POSTER
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={dims.width}
      height={dims.height}
      className={`rounded object-cover ${dims.className} ${className}`}
    />
  );
}
