/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        'mono': ['Consolas', 'Courier New', 'monospace'],
      },
      colors: {
        'neon-blue': '#00ffff',
        'neon-green': '#00e676',
        'neon-pink': '#ff00ff',
      },
    },
  },
  plugins: [],
}
