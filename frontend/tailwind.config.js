/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: "#FF6B35",
        "primary-dark": "#E55A2B",
        accent: "#FF8E53",
        "background-light": "#f6f8f7",
        "background-dark": "#122017",
        "surface-dark": "#1c252b",
        "surface-card": "#2C3435",
        "text-main": "#FFFFFF",
        "text-muted": "#638881"
      },
      fontFamily: {
        display: ['Noto Serif', 'serif'],
        sans: ['Manrope', 'sans-serif'],
      },
      boxShadow: {
        glow: "0 0 15px rgba(57, 224, 121, 0.2)",
      }
    }
  },
  plugins: [],
}
