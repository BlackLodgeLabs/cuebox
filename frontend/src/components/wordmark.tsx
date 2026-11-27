import Link from "next/link";
import { cn } from "@/lib/utils";

export function Wordmark({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="Cuebox"
      className={cn(
        "cb-opsz-72 shrink-0 font-display text-cb-section leading-none",
        className,
      )}
    >
      <span className="text-cb-accent">Cue</span>
      <span className="text-cb-teal">box.</span>
    </Link>
  );
}
