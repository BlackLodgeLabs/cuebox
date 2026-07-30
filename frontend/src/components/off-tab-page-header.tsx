import Link from "next/link";

interface OffTabPageHeaderProps {
  title: string;
  subtitle?: string;
}

export function OffTabPageHeader({ title, subtitle }: OffTabPageHeaderProps) {
  return (
    <div className="space-y-3">
      <Link
        href="/"
        className="inline-flex min-h-11 items-center text-body-md text-muted-foreground hover:text-foreground"
      >
        ← Home
      </Link>
      <div>
        <h1 className="text-h1">{title}</h1>
        {subtitle ? (
          <p className="mt-1 text-body-md text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}
