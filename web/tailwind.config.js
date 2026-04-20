/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,html}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f3f0ff',
          100: '#e5deff',
          200: '#cbbeff',
          300: '#a98cff',
          400: '#9066ff',
          500: '#7e47ff',
          600: '#6b2ef5',
          700: '#5a1fdc',
          800: '#4a1ab8',
          900: '#3a1590',
        },
        surface: '#181C23',
        'surface-soft': '#222834',
        border: '#2C3442',
        bg: '#0F1115',
      },
    },
  },
  plugins: [],
};
