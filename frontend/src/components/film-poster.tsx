"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface FilmPosterProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  size?: "sm" | "md" | "lg" | "fill";
  priority?: boolean;
  sizes?: string;
}

const SIZES = {
  sm: { width: 80, height: 120, className: "h-[120px] w-[80px]" },
  md: { width: 120, height: 180, className: "h-[180px] w-[120px]" },
  lg: { width: 200, height: 300, className: "h-[300px] w-[200px]" },
  fill: { width: 200, height: 300, className: "h-full w-full" },
};

function PosterPlaceholder({
  size,
  className,
}: {
  size: keyof typeof SIZES;
  className?: string;
}) {
  const dims = SIZES[size];
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded bg-surface-high text-label-md text-muted-foreground",
        size === "fill" && "absolute inset-0",
        dims.className,
        className,
      )}
    >
      NO POSTER
    </div>
  );
}

export function FilmPoster({
  src,
  alt,
  className = "",
  size = "md",
  priority,
  sizes,
}: FilmPosterProps) {
  const dims = SIZES[size];
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return <PosterPlaceholder size={size} className={className} />;
  }

  if (size === "fill") {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        sizes={sizes}
        className={cn("rounded object-cover", className)}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={dims.width}
      height={dims.height}
      priority={priority}
      sizes={sizes}
      className={cn("rounded object-cover", dims.className, className)}
      onError={() => setFailed(true)}
    />
  );
}
