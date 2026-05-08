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
          primary: "#FFFFFF",    // CHANGÉ: Blanc
          secondary: "#E5E7EB",  // CHANGÉ: Gris (Tailwind gray-200)
          dark: "#0a0e27",
          darker: "#050814",
          accent: "#9CA3AF",     // CHANGÉ: Gris (Tailwind gray-400)
        },
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