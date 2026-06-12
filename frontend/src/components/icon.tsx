import { cn } from "@/lib/utils";

export interface IconProps {
  name: string;
  filled?: boolean;
  size?: number;
  className?: string;
}

export function Icon({ name, filled = false, size = 24, className }: IconProps) {
  return (
    <span
      className={cn("material-symbols-outlined leading-none", className)}
      style={{
        fontSize: size,
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' ${size}`,
      }}
      aria-hidden
    >
      {name}
    </span>
  );
}
