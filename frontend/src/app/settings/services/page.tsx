"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ErrorState } from "@/components/error-state";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useStreamingServices } from "@/hooks/use-streaming-services";
import { ApiClientError } from "@/lib/api-client";
import { countryLabel, MY_SERVICES_INTRO } from "@/lib/watch-services";
import { cn } from "@/lib/utils";

export default function MyServicesPage() {
  const router = useRouter();
  const services = useStreamingServices();
  const [selected, setSelected] = useState<number[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (services.saved.data) {
      setSelected(services.saved.data.provider_ids);
    }
  }, [services.saved.data]);

  const country = services.saved.data?.country_code ?? services.catalog.data?.country_code ?? "GB";
  const providers = services.catalog.data?.providers ?? [];
  const loading = services.saved.isLoading || services.catalog.isLoading;
  const failed = services.saved.isError || services.catalog.isError;

  function toggle(providerId: number) {
    setSelected((current) =>
      current.includes(providerId)
        ? current.filter((id) => id !== providerId)
        : [...current, providerId],
    );
  }

  async function save() {
    setSaveError(null);
    try {
      await services.save.mutateAsync(selected);
      router.push("/more");
    } catch (error) {
      setSaveError(
        error instanceof ApiClientError
          ? error.message
          : "Could not save your services. Try again.",
      );
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="flex items-center gap-1">
        <Link
          href="/more"
          aria-label="Back"
          className="flex h-11 w-11 items-center justify-center text-cb-text"
        >
          <Icon name="chevron_left" size={24} />
        </Link>
        <h1 className="font-display text-cb-page leading-none">My services</h1>
      </div>

      <p className="mt-4 font-ui text-cb-body text-cb-muted">{MY_SERVICES_INTRO}</p>
      <p className="mt-5 font-mono text-cb-meta uppercase tracking-[0.04em] text-cb-muted">
        {countryLabel(country)}
      </p>

      {loading ? (
        <div className="mt-4 flex flex-wrap gap-2" aria-busy="true" aria-label="Loading services">
          <Skeleton className="h-11 w-24 bg-cb-surface" />
          <Skeleton className="h-11 w-28 bg-cb-surface" />
          <Skeleton className="h-11 w-20 bg-cb-surface" />
        </div>
      ) : null}

      {failed ? (
        <ErrorState
          title="Could not load services"
          message="The provider list could not be loaded right now."
          onRetry={() => {
            void services.saved.refetch();
            void services.catalog.refetch();
          }}
        />
      ) : null}

      {!loading && !failed && providers.length === 0 ? (
        <p className="mt-4 font-ui text-cb-body text-cb-muted">
          No services are listed for this country right now.
        </p>
      ) : null}

      {!loading && !failed && providers.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Streaming services">
          {providers.map((provider) => {
            const isSelected = selected.includes(provider.provider_id);
            return (
              <button
                key={provider.provider_id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => toggle(provider.provider_id)}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-cb border px-3 py-2 font-ui text-cb-caption",
                  isSelected
                    ? "border-cb-teal bg-cb-surface text-cb-teal"
                    : "border-cb-divider bg-cb-surface text-cb-muted",
                )}
              >
                {provider.provider_name}
              </button>
            );
          })}
        </div>
      ) : null}

      {saveError ? <p className="mt-4 font-ui text-cb-caption text-cb-danger">{saveError}</p> : null}

      <Button
        type="button"
        variant="secondary"
        className="mt-8 h-12 w-full"
        disabled={loading || failed || services.save.isPending}
        onClick={() => void save()}
      >
        {services.save.isPending ? "Saving…" : "Done"}
      </Button>
    </div>
  );
}
