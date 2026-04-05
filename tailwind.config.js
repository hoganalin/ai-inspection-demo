/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        factory: {
          bg: '#0a0e1a',
          panel: '#111827',
          border: '#1f2937',
          accent: '#00d4ff',
          green: '#00e676',
          red: '#ff3d57',
          yellow: '#ffd600',
        },
      },
    },
  },
  plugins: [],
};

