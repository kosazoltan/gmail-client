/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Szemkímélő sötét mód színek
        dark: {
          bg: '#1a1b1e',
          'bg-secondary': '#25262b',
          'bg-tertiary': '#2c2e33',
          border: '#373a40',
          text: '#c1c2c5',
          'text-secondary': '#909296',
          'text-muted': '#5c5f66',
        },
      },
    },
  },
  plugins: [],
};
