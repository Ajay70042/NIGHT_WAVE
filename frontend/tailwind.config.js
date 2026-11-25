/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
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
        hairline: "var(--hairline)",
        sidebar: {
          DEFAULT: "var(--sidebar)",
          foreground: "var(--sidebar-foreground)",
          primary: "var(--sidebar-primary)",
          "primary-foreground": "var(--sidebar-primary-foreground)",
          accent: "var(--sidebar-accent)",
          "accent-foreground": "var(--sidebar-accent-foreground)",
          border: "var(--sidebar-border)",
          ring: "var(--sidebar-ring)",
        },
        obsidian: "#050508",
        surface:  "#0c0c10",
        elevated: "#121216",
      },
      fontFamily: {
        display: ["Fraunces", "DM Serif Display", "Georgia", "serif"],
        body: ["Manrope", "Inter", "system-ui", "sans-serif"],
        sans: ["Manrope", "Inter", "system-ui", "sans-serif"],
        kr: ["Noto Serif KR", "Georgia", "serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      boxShadow: {
        art: "var(--shadow-art)",
        card: "0 2px 20px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.03)",
        player: "0 -1px 0 rgba(255,255,255,0.05), 0 0 0 1px rgba(255,255,255,0.03), 0 40px 100px rgba(0,0,0,0.95)",
      },
      animation: {
        "spin-slow": "spin 8s linear infinite",
        "pulse-soft": "pulse-soft 3s ease-in-out infinite",
        "slide-up": "slide-up 0.4s cubic-bezier(0.16,1,0.3,1)",
        "slide-right": "slide-right 0.35s cubic-bezier(0.16,1,0.3,1)",
        "fade-in": "fade-in 0.25s ease",
        marquee: "marquee 12s linear infinite",
        shimmer: "shimmer 2s linear infinite",
      },
      keyframes: {
        "pulse-soft": {
          "0%,100%": { opacity: 0.5 },
          "50%": { opacity: 1 },
        },
        "slide-up": {
          from: { opacity: 0, transform: "translateY(20px)" },
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
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
      },
    },
  },
  plugins: [],
};
