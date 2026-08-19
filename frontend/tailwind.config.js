/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        obsidian: "#0a0a0c",
        surface: "#111114",
        elevated: "#18181c",
        border: "#222226",
        accent: {
          DEFAULT: "#a3e635", // lime
          blue: "#38bdf8",    // electric blue
          dim: "#6b7280",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["'DM Serif Display'", "Georgia", "serif"],
      },
      animation: {
        "spin-slow": "spin 8s linear infinite",
        "pulse-ring": "pulse-ring 2s ease-in-out infinite",
        "slide-up": "slide-up 0.4s cubic-bezier(0.16,1,0.3,1)",
        "slide-right": "slide-right 0.35s cubic-bezier(0.16,1,0.3,1)",
        "fade-in": "fade-in 0.3s ease",
        marquee: "marquee 12s linear infinite",
      },
      keyframes: {
        "pulse-ring": {
          "0%,100%": { boxShadow: "0 0 0 0 rgba(163,230,53,0.15)" },
          "50%": { boxShadow: "0 0 0 12px rgba(163,230,53,0)" },
        },
        "slide-up": {
          from: { opacity: 0, transform: "translateY(24px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        "slide-right": {
          from: { opacity: 0, transform: "translateX(100%)" },
          to: { opacity: 1, transform: "translateX(0)" },
        },
        "fade-in": {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      backdropBlur: { xs: "2px" },
    },
  },
  plugins: [],
};
