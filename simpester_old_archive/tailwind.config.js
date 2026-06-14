/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#05060a",
        surface: "#141218",
        "surface-low": "#1d1b20",
        "surface-container": "#211f24",
        "surface-high": "#2b292f",
        "surface-bright": "#3b383e",
        "on-surface": "#e6e0e9",
        "on-surface-variant": "#cbc4d2",
        outline: "#948e9c",
        "outline-variant": "#494551",
        primary: "#cfbcff",
        "primary-container": "#6750a4",
        "on-primary": "#381e72",
        "on-primary-container": "#e0d2ff",
        secondary: "#cdc0e9",
        tertiary: "#e7c365",
        error: "#ffb4ab",
        "error-container": "#93000a",
        success: "#7ee0a7",
      },
      fontFamily: {
        display: ["Geist", "Inter", "system-ui", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        sm: "0.25rem",
        DEFAULT: "0.5rem",
        md: "0.75rem",
        lg: "1rem",
        xl: "1.5rem",
      },
      boxShadow: {
        glow: "0 0 22px -4px rgba(124,92,255,0.55)",
        ambient: "0 24px 50px -24px rgba(0,0,0,0.7)",
      },
      backgroundImage: {
        accent: "linear-gradient(135deg, #7c5cff 0%, #b39dff 100%)",
      },
      keyframes: {
        pulseGlow: {
          "0%,100%": { opacity: "0.5" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        pulseGlow: "pulseGlow 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
