import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import config from "../../tailwind.config";

const frontendRoot = path.resolve(__dirname, "../..");

function collectSource(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === "fonts") {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectSource(full));
      continue;
    }
    if (/\.(tsx?|css)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const sourceFiles = [
  ...collectSource(path.join(frontendRoot, "src")),
  path.join(frontendRoot, "tailwind.config.ts"),
];

function sourceText(): { file: string; text: string }[] {
  return sourceFiles.map((file) => ({ file, text: readFileSync(file, "utf8") }));
}

describe("Cuebox foundations", () => {
  it("bundles Big Shoulders, Archivo, and IBM Plex Mono locally", () => {
    for (const file of [
      "BigShoulders-Variable.ttf",
      "Archivo-Variable.ttf",
      "IBMPlexMono-Regular.ttf",
      "IBMPlexMono-Medium.ttf",
    ]) {
      expect(existsSync(path.join(frontendRoot, "src/fonts", file)), file).toBe(true);
    }

    const layout = readFileSync(path.join(frontendRoot, "src/app/layout.tsx"), "utf8");
    expect(layout).toContain("next/font/local");
    expect(layout).toContain("BigShoulders-Variable.ttf");
    expect(layout).toContain("Archivo-Variable.ttf");
    expect(layout).toContain("IBMPlexMono-Regular.ttf");
    expect(layout).toContain("IBMPlexMono-Medium.ttf");
    expect(layout).not.toContain("next/font/google");
  });

  it("keeps retired faces and default shadcn greys out of the frontend", () => {
    const banned: { name: string; pattern: RegExp }[] = [
      { name: "Inter", pattern: /["']Inter["']|\bInter\b/ },
      { name: "IBM Plex Sans", pattern: /IBM Plex Sans/ },
      { name: "Cabin", pattern: /\bCabin\b|Libre[_\s]Franklin/ },
      { name: "Space Mono", pattern: /Space[_\s]Mono/ },
      {
        name: "shadcn grey utility",
        pattern: /(?:bg|text|border|from|to|via|ring)-(?:zinc|slate|neutral|gray)-\d/,
      },
      { name: "shadcn grey hex", pattern: /#(?:f8fafc|f1f5f9|e2e8f0|09090b|fafafa|f4f4f5)\b/i },
      { name: "shadcn grey hsl", pattern: /hsl\(\s*240\s+(?:5\.9%|10%\s+3\.9%)/ },
      { name: "neo-noir palette", pattern: /#(?:121411|aed0a3|cccc5c|ffb4ab|1a1c19)\b/i },
      { name: "sage glow", pattern: /rgba\(\s*174\s*,\s*208\s*,\s*163|rgba\(\s*204\s*,\s*204\s*,\s*92/ },
    ];

    const hits: string[] = [];
    for (const { file, text } of sourceText()) {
      for (const rule of banned) {
        if (rule.pattern.test(text)) {
          hits.push(`${path.relative(frontendRoot, file)}: ${rule.name}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it("allows amber glow only", () => {
    const tokens = readFileSync(path.join(frontendRoot, "src/styles/tokens.css"), "utf8");
    expect(tokens).toContain("--cb-glow: 0 0 18px rgba(224, 122, 40, 0.5)");

    const hits: string[] = [];
    for (const { file, text } of sourceText()) {
      for (const line of text.split("\n")) {
        const glow = /glow|box-shadow|shadow-/.test(line);
        const teal = /2a9a94|42\s*,\s*154\s*,\s*148/i.test(line);
        if (glow && teal) {
          hits.push(`${path.relative(frontendRoot, file)}: ${line.trim()}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it("exposes Cuebox colour, radius, spacing, and type tokens to Tailwind", () => {
    const tokens = readFileSync(path.join(frontendRoot, "src/styles/tokens.css"), "utf8");
    for (const declaration of [
      "--cb-bg: #0b0b0b",
      "--cb-surface: #171717",
      "--cb-text: #f3ede4",
      "--cb-muted: #a39e96",
      "--cb-accent: #e07a28",
      "--cb-teal: #2a9a94",
      "--cb-divider: #2a2a2a",
      "--cb-ink: #0b0b0b",
      "--cb-danger: #c75b4a",
      "--cb-radius: 12px",
      "--cb-radius-sm: 8px",
      "--cb-radius-lg: 16px",
      "--cb-radius-pill: 999px",
      "--cb-space-1: 4px",
      "--cb-space-2: 8px",
      "--cb-space-3: 16px",
      "--cb-space-4: 24px",
      "--cb-space-5: 32px",
      "--cb-space-6: 48px",
      "--cb-ease-out:",
      "--cb-home-iris-dur:",
      "--background: var(--cb-bg)",
      "--primary: var(--cb-accent)",
      "--primary-foreground: var(--cb-ink)",
    ]) {
      expect(tokens, declaration).toContain(declaration);
    }

    const extend = config.theme?.extend as {
      colors?: { cb?: Record<string, string> };
      borderRadius?: Record<string, string>;
      spacing?: Record<string, string>;
      boxShadow?: Record<string, string>;
      fontSize?: Record<string, unknown>;
      fontFamily?: Record<string, string[]>;
    };

    expect(extend.colors?.cb).toMatchObject({
      bg: "var(--cb-bg)",
      surface: "var(--cb-surface)",
      text: "var(--cb-text)",
      muted: "var(--cb-muted)",
      accent: "var(--cb-accent)",
      teal: "var(--cb-teal)",
      divider: "var(--cb-divider)",
      ink: "var(--cb-ink)",
      danger: "var(--cb-danger)",
    });
    expect(extend.borderRadius).toMatchObject({
      cb: "var(--cb-radius)",
      "cb-sm": "var(--cb-radius-sm)",
      "cb-lg": "var(--cb-radius-lg)",
      "cb-pill": "var(--cb-radius-pill)",
    });
    expect(extend.spacing).toMatchObject({
      "cb-1": "var(--cb-space-1)",
      "cb-2": "var(--cb-space-2)",
      "cb-3": "var(--cb-space-3)",
      "cb-4": "var(--cb-space-4)",
      "cb-5": "var(--cb-space-5)",
      "cb-6": "var(--cb-space-6)",
    });
    expect(extend.boxShadow?.glow).toBe("var(--cb-glow)");
    expect(extend.boxShadow).not.toHaveProperty("glow-lime");
    expect(extend.boxShadow).not.toHaveProperty("focus-lime");
    for (const step of [
      "cb-display",
      "cb-title",
      "cb-page",
      "cb-section",
      "cb-card",
      "cb-tile",
      "cb-body",
      "cb-ui",
      "cb-caption",
      "cb-tab",
      "cb-meta",
      "cb-meta-sm",
    ]) {
      expect(extend.fontSize, step).toHaveProperty(step);
    }
    expect(extend.fontFamily?.display?.[0]).toBe("var(--font-big-shoulders)");
    expect(extend.fontFamily?.ui?.[0]).toBe("var(--font-archivo)");
    expect(extend.fontFamily?.mono?.[0]).toBe("var(--font-ibm-plex-mono)");
  });
});
