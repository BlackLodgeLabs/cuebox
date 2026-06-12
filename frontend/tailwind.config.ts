import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        heading: ["var(--font-cabin)", "sans-serif"],
        body: ["var(--font-libre-franklin)", "sans-serif"],
        mono: ["var(--font-space-mono)", "monospace"],
      },
      spacing: {
        xs: "4px",
        sm: "8px",
        md: "16px",
        lg: "24px",
        xl: "32px",
      },
      maxWidth: {
        "7xl": "1280px",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) + 2px)",
        sm: "calc(var(--radius) - 2px)",
        DEFAULT: "var(--radius)",
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
      },
      boxShadow: {
        glow: "0 0 12px rgba(174, 208, 163, 0.35)",
        "glow-lime": "0 0 8px rgba(204, 204, 92, 0.4)",
        "focus-lime": "0 0 0 2px rgba(204, 204, 92, 0.25)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
