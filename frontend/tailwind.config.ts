import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      fontSize: {
        "page-title": ["1.5rem", { lineHeight: "2rem", fontWeight: "600", letterSpacing: "-0.025em" }],
        "section-title": ["1.125rem", { lineHeight: "1.5rem", fontWeight: "600", letterSpacing: "-0.02em" }],
        nav: ["0.8125rem", { lineHeight: "1rem", fontWeight: "500" }],
        "nav-group": ["0.6875rem", { lineHeight: "1rem", fontWeight: "600", letterSpacing: "0.08em" }],
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: "hsl(var(--card))",
        "card-foreground": "hsl(var(--card-foreground))",
        popover: "hsl(var(--popover))",
        "popover-foreground": "hsl(var(--popover-foreground))",
        primary: "hsl(var(--primary))",
        "primary-foreground": "hsl(var(--primary-foreground))",
        secondary: "hsl(var(--secondary))",
        "secondary-foreground": "hsl(var(--secondary-foreground))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        accent: "hsl(var(--accent))",
        "accent-foreground": "hsl(var(--accent-foreground))",
        destructive: "hsl(var(--destructive))",
        "destructive-foreground": "hsl(var(--destructive-foreground))",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        positive: {
          bg: "hsl(var(--positive-bg))",
          fg: "hsl(var(--positive-fg))",
          border: "hsl(var(--positive-border))",
        },
        caution: {
          bg: "hsl(var(--caution-bg))",
          fg: "hsl(var(--caution-fg))",
          border: "hsl(var(--caution-border))",
        },
        info: {
          bg: "hsl(var(--info-bg))",
          fg: "hsl(var(--info-fg))",
          border: "hsl(var(--info-border))",
        },
        negative: {
          bg: "hsl(var(--negative-bg))",
          fg: "hsl(var(--negative-fg))",
          border: "hsl(var(--negative-border))",
        },
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
          6: "hsl(var(--chart-6))",
          7: "hsl(var(--chart-7))",
          8: "hsl(var(--chart-8))",
        },
      },
      borderRadius: {
        xl: "var(--radius-xl)",
        lg: "var(--radius-lg)",
        md: "var(--radius-md)",
        sm: "var(--radius-sm)",
      },
      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        sidebar: "var(--shadow-sidebar)",
      },
      maxWidth: {
        app: "1600px",
      },
    },
  },
  plugins: [],
};

export default config;
