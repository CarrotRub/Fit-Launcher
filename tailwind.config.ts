import type { Config } from "tailwindcss";

const asRgb = (token: string) => `rgb(var(--${token}) / <alpha-value>)`;

export default <Config>{
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      animation: {
        "loading-bar": "loadingBar 1.5s infinite ease-in-out",
      },
      keyframes: {
        loadingBar: {
          "0%, 100%": { transform: "translateX(0%)" },
          "50%": { transform: "translateX(200%)" },
        },
      },
      colors: {
        accent: asRgb("accent-color"),
        primary: asRgb("primary-color"),
        secondary: asRgb("secondary-color"),
        "secondary-30": asRgb("secondary-30-color"),
        "secondary-20": asRgb("secondary-20-color"),
        text: asRgb("text-color"),
        muted: asRgb("muted-color"),
        background: asRgb("background-color"),
        "background-70": asRgb("background-70-color"),
        "background-30": asRgb("background-30-color"),
        popup: asRgb("popup-background-color"),
        "resume-accent": asRgb("resume-accent-color"),
        warning: asRgb("warning-orange"),
      },
    },
  },
  plugins: [],
};
