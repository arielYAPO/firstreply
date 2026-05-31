import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: "#070A0F",
        panel: "#0E131D",
        elevated: "#121A27",
        line: "rgba(148, 163, 184, 0.14)",
        accent: "#38BDF8",
        success: "#A3E635",
        warning: "#FACC15",
        danger: "#FB7185",
        acid: "#A3E635",
      },
    },
  },
  plugins: [],
};

export default config;
