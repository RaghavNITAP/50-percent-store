/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: "#0052FF",
      },
      keyframes: {
        "slide-up": {
          "0%": { transform: "translateY(100%)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
      animation: {
        "slide-up": "slide-up 0.3s ease-out",
      },
      boxShadow: {
        "brand-sm":  "0 2px 8px rgba(0,82,255,0.35)",
        "brand-md":  "0 4px_20px rgba(0,82,255,0.45)",
        "brand-card":"0 8px 30px rgba(0,82,255,0.12)",
        "brand-chip":"0 2px 12px rgba(0,82,255,0.35)",
      },
    },
  },
  plugins: [],
}