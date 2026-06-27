import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/app/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        border: "hsl(var(--border))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        primary: "hsl(var(--primary))",
        "primary-foreground": "hsl(var(--primary-foreground))"
      },
      boxShadow: {
        glow: "0 0 80px rgba(59, 130, 246, 0.28)"
      },
      keyframes: {
        scan: {
          "0%": { transform: "translateY(-80px)", opacity: "0" },
          "12%": { opacity: "1" },
          "90%": { opacity: "1" },
          "100%": { transform: "translateY(80px)", opacity: "0" }
        },
        drift: {
          "0%": { transform: "translate3d(0, 0, 0) scale(1)" },
          "50%": { transform: "translate3d(32px, -24px, 0) scale(1.06)" },
          "100%": { transform: "translate3d(-20px, 28px, 0) scale(0.96)" }
        }
      },
      animation: {
        scan: "scan 2.2s ease-in-out infinite",
        drift: "drift 12s ease-in-out infinite alternate"
      }
    }
  },
  plugins: []
};

export default config;
