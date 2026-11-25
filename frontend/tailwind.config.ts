import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-big-shoulders)", "sans-serif"],
        heading: ["var(--font-big-shoulders)", "sans-serif"],
        body: ["var(--font-archivo)", "sans-serif"],
        ui: ["var(--font-archivo)", "sans-serif"],
        mono: ["var(--font-ibm-plex-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        "cb-display": ["40px", { lineHeight: "1.05", fontWeight: "700" }],
        "cb-title": ["36px", { lineHeight: "1.05", fontWeight: "700" }],
        "cb-page": ["28px", { lineHeight: "1.1", fontWeight: "700" }],
        "cb-section": ["22px", { lineHeight: "1.1", fontWeight: "700" }],
        "cb-card": ["18px", { lineHeight: "1.15", fontWeight: "700" }],
        "cb-tile": ["16px", { lineHeight: "1.25", fontWeight: "700" }],
        "cb-body": ["15px", { lineHeight: "1.45", fontWeight: "500" }],
        "cb-ui": ["14px", { lineHeight: "1.4", fontWeight: "500" }],
        "cb-caption": ["13px", { lineHeight: "1.35", fontWeight: "500" }],
        "cb-tab": ["11px", { lineHeight: "1.2", fontWeight: "500" }],
        "cb-meta": ["11px", { lineHeight: "1.3", letterSpacing: "0.06em", fontWeight: "400" }],
        "cb-meta-sm": ["10px", { lineHeight: "1.3", letterSpacing: "0.06em", fontWeight: "500" }],
      },
      spacing: {
        xs: "var(--cb-space-1)",
        sm: "var(--cb-space-2)",
        md: "var(--cb-space-3)",
        lg: "var(--cb-space-4)",
        xl: "var(--cb-space-5)",
        "cb-1": "var(--cb-space-1)",
        "cb-2": "var(--cb-space-2)",
        "cb-3": "var(--cb-space-3)",
        "cb-4": "var(--cb-space-4)",
        "cb-5": "var(--cb-space-5)",
        "cb-6": "var(--cb-space-6)",
      },
      maxWidth: {
        "7xl": "1280px",
      },
      borderRadius: {
        DEFAULT: "var(--cb-radius)",
        lg: "var(--cb-radius-lg)",
        md: "var(--cb-radius)",
        sm: "var(--cb-radius-sm)",
        cb: "var(--cb-radius)",
        "cb-sm": "var(--cb-radius-sm)",
        "cb-lg": "var(--cb-radius-lg)",
        "cb-pill": "var(--cb-radius-pill)",
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        surface: {
          high: "var(--surface-container-high)",
          highest: "var(--surface-container-highest)",
        },
        cb: {
          bg: "var(--cb-bg)",
          surface: "var(--cb-surface)",
          text: "var(--cb-text)",
          muted: "var(--cb-muted)",
          accent: "var(--cb-accent)",
          teal: "var(--cb-teal)",
          divider: "var(--cb-divider)",
          ink: "var(--cb-ink)",
          danger: "var(--cb-danger)",
        },
      },
      boxShadow: {
        glow: "var(--cb-glow)",
        "glow-reco": "var(--cb-glow-reco)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
