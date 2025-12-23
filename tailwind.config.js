/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./app/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      colors: {
        agora: {
          blue: '#099DFD',
          dark: '#002766',
          grey: '#8A8A8A',
          light: '#F5F7F9',
          success: '#52C41A',
          warning: '#FAAD14',
          error: '#FF4D4F',
        },
        primary: {
          50: '#e6f4ff',
          100: '#bae0ff',
          200: '#91d5ff',
          300: '#69c0ff',
          400: '#40a9ff',
          500: '#099DFD',
          600: '#0070cc',
          700: '#0050a3',
          800: '#00357a',
          900: '#002152',
        }
      },
    },
  },
  plugins: [],
}

