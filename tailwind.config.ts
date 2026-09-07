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
        // -0.04em is the floor: tighter and mono glyphs start touching.
        "8xl": ["6rem", { lineHeight: "0.98", letterSpacing: "-0.04em" }],
      },
      // Semantic stacking scale - one place to reason about what sits over what.
      // Mirrors the --z-* custom properties in globals.css (used by plain CSS).
      zIndex: {
        floating: "40", // back-to-top and similar floating controls
        nav: "50",
        progress: "60", // reading-progress bar (above the nav)
        modal: "100",
        fx: "150", // one-shot button click overlays
        spark: "200", // ambient click sparks (topmost visual)
        skip: "300", // skip-to-content link, must beat everything when focused
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-in-out",
        "slide-up": "slideUp 0.5s ease-out",
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
      },
    },
  },
  plugins: [],
};
export default config;