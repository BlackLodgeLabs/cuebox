"use client";

import { useQuery } from "@tanstack/react-query";
import { getHealth } from "@/lib/api-client";

export default function HomePage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["health"],
    queryFn: getHealth,
  });

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-2xl font-semibold">Film Picker</h1>
      <p className="mt-2 text-muted-foreground">Cuebox</p>
      <div className="mt-6 rounded-lg border bg-card px-4 py-3 text-sm text-card-foreground">
        {isLoading && <p>Checking API health…</p>}
        {isError && <p className="text-destructive">API unreachable</p>}
        {data && (
          <div className="space-y-1">
            <p>
              API: <span className="font-medium">{data.status}</span>
            </p>
            <p>
              Database: <span className="font-medium">{data.database}</span>
            </p>
            <p className="text-muted-foreground">Version {data.version}</p>
          </div>
        )}
      </div>
    </main>
  );
}
