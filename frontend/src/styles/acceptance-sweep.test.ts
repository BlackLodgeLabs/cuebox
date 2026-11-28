import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const frontendRoot = path.resolve(__dirname, "../..");

/** Walk up from the frontend package. The Compose dev container bind-mounts only `./frontend` at `/app`, so the repo docs are absent there and CI (full checkout) is what checks them. */
function repoDocsRoot(start: string): string | null {
  let dir = start;
  for (let i = 0; i < 6; i += 1) {
    if (existsSync(path.join(dir, "AGENTS.md")) && existsSync(path.join(dir, "README.md"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

const deadCeremony = [
  "src/components/recommendation-ceremony.tsx",
  "src/components/recommendation-ceremony.test.tsx",
  "src/components/results-view.tsx",
  "src/components/results-view.test.tsx",
  "src/components/ceremony/ceremony-shared.tsx",
  "src/components/ceremony/ceremony-shared.test.tsx",
  "src/components/ceremony/ceremony-stage-record.tsx",
  "src/components/ceremony/ceremony-stage-runners-up.tsx",
  "src/components/ceremony/ceremony-stage-winner.tsx",
  "src/hooks/use-ceremony-navigation.ts",
  "src/lib/ceremony-gate.ts",
  "src/lib/ceremony-gate.test.ts",
];

describe("acceptance sweep", () => {
  it("removes the ceremony, its gate, and the old results view", () => {
    const present = deadCeremony.filter((file) =>
      existsSync(path.join(frontendRoot, file)),
    );
    expect(present).toEqual([]);
  });

  it("drops ceremony motion rules from the global stylesheet", () => {
    const css = readFileSync(path.join(frontendRoot, "src/app/globals.css"), "utf8");
    expect(css).not.toMatch(/ceremony-stage|ceremony-reduced-motion/);
  });

  it("keeps the reduced-motion star crossfade at 300ms", () => {
    const css = readFileSync(path.join(frontendRoot, "src/app/globals.css"), "utf8");
    const reduced = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduced).toContain('[data-star-fill="crossfade"]');
    expect(reduced).toMatch(
      /\[data-star-fill="crossfade"\][\s\S]*transition-property:\s*opacity\s*!important[\s\S]*transition-duration:\s*var\(--cb-dur-reduced,\s*300ms\)\s*!important/,
    );
  });

  it("points the agent and readme docs at the redesign pack", () => {
    const repoRoot = repoDocsRoot(path.resolve(frontendRoot, ".."));
    if (!repoRoot) {
      expect(process.env.CI).toBeUndefined();
      return;
    }
    const agents = readFileSync(path.join(repoRoot, "AGENTS.md"), "utf8");
    const readme = readFileSync(path.join(repoRoot, "README.md"), "utf8");
    for (const doc of [agents, readme]) {
      expect(doc).toContain("docs/design/redesign-2026-11/");
      expect(doc).not.toMatch(/Modern Neo-Noir Cinema design system/);
    }
  });
});
