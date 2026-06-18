import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          primary: "#FFFFFF",
          secondary: "#E5E7EB",
          dark: "#0a0e27",
          darker: "#050814",
          accent: "#B8C0D2",    // muted text — aligned with CSS var, AA on #050814
          brand: "#34D399",     // terminal emerald — primary accent
          brand2: "#10B981",    // deeper emerald — hover / secondary accent
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "ui-monospace", "monospace"],
        mono: ["var(--font-display)", "ui-monospace", "monospace"],
      },
      fontSize: {
        // Tighter tracking + line-height on display sizes for deliberate punch
        "5xl": ["3rem", { lineHeight: "1.05", letterSpacing: "-0.03em" }],
        "6xl": ["3.75rem", { lineHeight: "1.02", letterSpacing: "-0.035em" }],
        "7xl": ["4.5rem", { lineHeight: "1", letterSpacing: "-0.04em" }],
        "8xl": ["6rem", { lineHeight: "0.98", letterSpacing: "-0.045em" }],
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-in-out",
        "slide-up": "slideUp 0.5s ease-out",
        "glow": "glow 2s ease-in-out infinite alternate",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        glow: {
          // CHANGÉ pour la nouvelle couleur primaire (blanc)
          "0%": { boxShadow: "0 0 5px #FFFFFF, 0 0 10px #FFFFFF" },
          "100%": { boxShadow: "0 0 10px #FFFFFF, 0 0 20px #FFFFFF, 0 0 30px #FFFFFF" },
        },
      },
    },
  },
  plugins: [],
};
export default config;