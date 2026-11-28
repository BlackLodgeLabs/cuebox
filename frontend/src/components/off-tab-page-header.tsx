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
        className="inline-flex min-h-11 items-center font-ui text-cb-body text-cb-teal hover:underline"
      >
        ← Home
      </Link>
      <div>
        <h1 className="text-h1">{title}</h1>
        {subtitle ? (
          <p className="mt-1 font-ui text-cb-body text-cb-muted">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}
