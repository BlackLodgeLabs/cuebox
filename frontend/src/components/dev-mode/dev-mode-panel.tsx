"use client";

import { useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useDevAI,
  useDevRetrieval,
  useDevScoring,
  useDevSystemVersions,
} from "@/hooks/use-dev-mode";
import { useDevMode } from "@/components/dev-mode/dev-mode-provider";

interface DevModePanelProps {
  sessionId: string;
}

function MonoValue({ children }: { children: ReactNode }) {
  return <span className="font-mono text-label-md text-foreground">{children}</span>;
}

function LoadingBlock() {
  return <p className="text-body-md text-muted-foreground">Loading trace…</p>;
}

function ErrorBlock({ message }: { message: string }) {
  return <p className="text-body-md text-destructive">{message}</p>;
}

function RetrievalTab({
  sessionId,
  active,
}: {
  sessionId: string;
  active: boolean;
}) {
  const { data, isLoading, isError } = useDevRetrieval(sessionId, active);

  if (isLoading) return <LoadingBlock />;
  if (isError || !data) return <ErrorBlock message="Could not load retrieval trace." />;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <p className="text-label-md text-muted-foreground">Profile hash</p>
          <MonoValue>{data.profile.profile_hash}</MonoValue>
        </div>
        <div>
          <p className="text-label-md text-muted-foreground">Cache hit</p>
          <MonoValue>{data.profile.profile_cache_hit ? "true" : "false"}</MonoValue>
        </div>
        <div>
          <p className="text-label-md text-muted-foreground">Embedding model</p>
          <MonoValue>{data.profile.embedding_model ?? "—"}</MonoValue>
        </div>
        <div>
          <p className="text-label-md text-muted-foreground">Embedding version</p>
          <MonoValue>{data.profile.embedding_version ?? "—"}</MonoValue>
        </div>
      </div>
      {data.profile.narrative_profile ? (
        <div>
          <p className="text-label-md text-muted-foreground">Narrative profile</p>
          <p className="text-body-md">{data.profile.narrative_profile}</p>
        </div>
      ) : null}
      <div>
        <p className="mb-2 text-label-md text-muted-foreground">
          Candidates ({data.candidates_returned} / limit {data.retrieval_candidate_limit})
        </p>
        <div className="max-h-72 overflow-auto rounded border border-outline">
          <table className="w-full text-left text-label-md">
            <thead className="bg-surface-high">
              <tr>
                <th className="px-3 py-2">Rank</th>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Similarity</th>
              </tr>
            </thead>
            <tbody>
              {data.candidates.map((candidate) => (
                <tr key={candidate.film_id} className="border-t border-outline">
                  <td className="px-3 py-2 font-mono">{candidate.retrieval_rank ?? "—"}</td>
                  <td className="px-3 py-2">{candidate.title}</td>
                  <td className="px-3 py-2 font-mono">
                    {candidate.similarity_score?.toFixed(4) ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ScoringTab({
  sessionId,
  active,
}: {
  sessionId: string;
  active: boolean;
}) {
  const { data, isLoading, isError } = useDevScoring(sessionId, active);

  if (isLoading) return <LoadingBlock />;
  if (isError || !data) return <ErrorBlock message="Could not load scoring detail." />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 font-mono text-label-md">
        <Badge variant="outline">scoring: {data.scoring_version ?? "—"}</Badge>
        <Badge variant="outline">weights: {data.weight_set ?? "—"}</Badge>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {Object.entries(data.weights).map(([key, value]) => (
          <div key={key} className="flex items-center justify-between rounded border border-outline px-3 py-2">
            <span className="text-label-md text-muted-foreground">{key}</span>
            <MonoValue>{value.toFixed(2)}</MonoValue>
          </div>
        ))}
      </div>
      <div className="max-h-72 overflow-auto rounded border border-outline">
        <table className="w-full text-left text-label-md">
          <thead className="bg-surface-high">
            <tr>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Raw</th>
              <th className="px-3 py-2">Final</th>
              <th className="px-3 py-2">LLM rank</th>
            </tr>
          </thead>
          <tbody>
            {data.candidates.map((candidate) => (
              <tr key={candidate.film_id} className="border-t border-outline">
                <td className="px-3 py-2">{candidate.title}</td>
                <td className="px-3 py-2 font-mono">{candidate.raw_score?.toFixed(4) ?? "—"}</td>
                <td className="px-3 py-2 font-mono">{candidate.final_score?.toFixed(4) ?? "—"}</td>
                <td className="px-3 py-2 font-mono">{candidate.llm_rank ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AITab({
  sessionId,
  active,
}: {
  sessionId: string;
  active: boolean;
}) {
  const { data, isLoading, isError } = useDevAI(sessionId, active);

  if (isLoading) return <LoadingBlock />;
  if (isError || !data) return <ErrorBlock message="Could not load AI detail." />;

  const sections = [
    { label: "Semantic enrichment", value: data.semantic_enrichment },
    { label: "Embedding", value: data.embedding },
    { label: "Ranking", value: data.ranking },
  ] as const;

  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <div key={section.label} className="rounded border border-outline p-3">
          <p className="mb-2 text-label-md text-muted-foreground">{section.label}</p>
          <div className="grid gap-2 md:grid-cols-2">
            {Object.entries(section.value).map(([key, value]) => (
              <div key={key}>
                <p className="text-label-md text-muted-foreground">{key}</p>
                <MonoValue>{value ?? "—"}</MonoValue>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function VersionsTab({ active }: { active: boolean }) {
  const { data, isLoading, isError } = useDevSystemVersions(active);

  if (isLoading) return <LoadingBlock />;
  if (isError || !data) return <ErrorBlock message="Could not load system versions." />;

  return (
    <div className="max-h-72 overflow-auto rounded border border-outline">
      <table className="w-full text-left text-label-md">
        <thead className="bg-surface-high">
          <tr>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Version</th>
          </tr>
        </thead>
        <tbody>
          {data.versions.map((entry) => (
            <tr key={`${entry.artifact_name}-${entry.version}`} className="border-t border-outline">
              <td className="px-3 py-2 font-mono">{entry.artifact_type}</td>
              <td className="px-3 py-2">{entry.artifact_name}</td>
              <td className="px-3 py-2 font-mono">{entry.version}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DevModePanel({ sessionId }: DevModePanelProps) {
  const { isEnabled, isOpen } = useDevMode();
  const [activeTab, setActiveTab] = useState("retrieval");

  if (!isEnabled || !isOpen) {
    return null;
  }

  return (
    <Card className="border-secondary/40 bg-surface-high">
      <CardHeader>
        <CardTitle className="text-h2">Developer Mode</CardTitle>
        <CardDescription className="text-body-md">
          Internal recommendation trace for session{" "}
          <span className="font-mono text-label-md">{sessionId}</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="retrieval">Retrieval</TabsTrigger>
            <TabsTrigger value="scoring">Scoring</TabsTrigger>
            <TabsTrigger value="ai">AI</TabsTrigger>
            <TabsTrigger value="versions">Versions</TabsTrigger>
          </TabsList>
          <TabsContent value="retrieval" className="mt-4">
            <RetrievalTab sessionId={sessionId} active={activeTab === "retrieval"} />
          </TabsContent>
          <TabsContent value="scoring" className="mt-4">
            <ScoringTab sessionId={sessionId} active={activeTab === "scoring"} />
          </TabsContent>
          <TabsContent value="ai" className="mt-4">
            <AITab sessionId={sessionId} active={activeTab === "ai"} />
          </TabsContent>
          <TabsContent value="versions" className="mt-4">
            <VersionsTab active={activeTab === "versions"} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
