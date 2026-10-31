/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: { colors: { ink: "#14243b", cobalt: "#3157d5", paper: "#f5f7fa" } },
  },
  plugins: [],
};
