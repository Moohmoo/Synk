import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["Geist Mono", "monospace"],
      },
      colors: {
        riot: {
          bg: "#0a0a0c",
          panel: "#141417",
          teal: "#0ac8b9",
          orange: "#ff4655",
        },
      },
      letterSpacing: {
        widest: "0.15em",
      },
    },
  },
  plugins: [],
};

export default config;
