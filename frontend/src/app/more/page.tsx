import Link from "next/link";
import { Icon } from "@/components/icon";

const MORE_DESTINATIONS = [
  {
    href: "/settings/sync",
    label: "Sync",
    description: "CSV sync, watched diary, and RSS polling.",
    icon: "sync" as const,
  },
  {
    href: "/import",
    label: "Import",
    description: "Upload a Letterboxd watchlist CSV.",
    icon: "upload_file" as const,
  },
  {
    href: "/history",
    label: "History",
    description: "Browse past recommendations.",
    icon: "history" as const,
  },
] as const;

export default function MorePage() {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-h1">More</h1>
        <p className="mt-1 text-body-md text-muted-foreground">
          Sync, import, and recommendation history.
        </p>
      </div>

      <nav aria-label="More destinations" className="divide-y divide-border border-y border-border">
        {MORE_DESTINATIONS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex min-h-11 items-center gap-3 py-3 text-left transition-colors duration-150 motion-reduce:transition-none hover:bg-surface-high/60"
          >
            <Icon
              name={item.icon}
              size={22}
              className="shrink-0 text-muted-foreground"
            />
            <span className="min-w-0 flex-1">
              <span className="block font-heading text-body-md text-foreground">
                {item.label}
              </span>
              <span className="mt-0.5 block text-label-md normal-case tracking-normal text-muted-foreground">
                {item.description}
              </span>
            </span>
            <Icon
              name="chevron_right"
              size={20}
              className="shrink-0 text-muted-foreground"
            />
          </Link>
        ))}
      </nav>
    </div>
  );
}
