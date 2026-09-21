import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class',
  /*
   * TOUCH-FIX (Sticky Hover): `hoverOnlyWhenSupported` kapselt ALLE `hover:`-
   * Utilities global in `@media (hover: hover)`. Dadurch greifen Hover-Effekte
   * ausschließlich auf echten Zeigegeräten (Desktop-Maus/Trackpad). Auf
   * Smartphones/Tablets bleibt nach dem Antippen kein Farbzustand mehr hängen –
   * dort gibt ausschließlich der `:active`-Zustand kurzes Druck-Feedback.
   */
  future: {
    hoverOnlyWhenSupported: true,
  },
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
        fontFamily: {
          sans: ["var(--font-sans)", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
          mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
        },
        colors: {
            background: "var(--background)", // Wird via CSS-Variablen überschrieben
            foreground: "var(--foreground)",
            // Subtle Luxury — semantische Tokens (Slate/Orange)
            surface: { DEFAULT: "var(--surface)", muted: "var(--surface-muted)" },
            border: { DEFAULT: "var(--border)", strong: "var(--border-strong)" },
            muted: "var(--muted)",
            violet: "var(--violet)",
            success: "var(--success)",
            danger: "var(--danger)",
            // Spaceship UI Color System
            primary: {
              orange: "var(--primary-orange)", // hsl(14, 100%, 50%)
            },
            accent: {
              DEFAULT: "var(--accent)",
              hover: "var(--accent-hover)",
              text: "var(--accent-text)",
              foreground: "var(--accent-foreground)",
              soft: "var(--accent-soft)",
              cyan: "var(--accent-cyan)", // hsl(180, 100%, 50%)
              lime: "var(--accent-lime)", // hsl(65, 100%, 50%) - Electric Lime
            },
            // Darkmode Spaceship Colors
            dm: {
              "surface-teal": "var(--dm-surface-teal)", // hsl(184, 96%, 9%)
              "border-slate": "var(--dm-border-slate)", // hsl(225, 17%, 26%)
              "text-main": "var(--dm-text-main)", // hsl(0, 0%, 95%)
              "text-muted": "var(--dm-text-muted)", // hsl(225, 10%, 60%)
            },
            // Lightmode Organic Scholar Colors
            lm: {
              "bg-bone": "var(--lm-bg-bone)", // hsl(45, 33%, 96%)
              "text-espresso": "var(--lm-text-espresso)", // hsl(0, 10%, 27%)
              "accent-sage": "var(--lm-accent-sage)", // hsl(158, 55%, 78%)
            },
            // Legacy Brand Support
            brand: {
              blue: "#0047FF",    // Das Blau aus deinem Logo
              orange: "var(--primary-orange)",  // Verwendet jetzt CSS-Variable
              dark: "#001A3D",
            },
            glass: {
              dark: "var(--dm-surface-teal)",
              light: "rgba(255, 255, 255, 0.5)",
            }
          },
      backgroundImage: {
        gold: "linear-gradient(135deg, var(--gold-from), var(--gold-via) 55%, var(--gold-to))",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
      },
      borderRadius: {
        "2xl": "1.25rem",
        "3xl": "1.75rem",
      },
      animation: {
        'marquee': 'marquee 20s linear infinite',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
    },
  },
  plugins: [],
};
export default config;