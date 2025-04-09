const defaultTheme = require('tailwindcss/defaultTheme');

module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        'sans': ['Roboto', ...defaultTheme.fontFamily.sans],
      },
      colors: {
        gray: {
          600: '#4a5568',   // Slightly lighter
          700: '#2d3748',   // Mid-tone
          800: '#1a202c',   // Darker
          900: '#171923',   // Darkest
        },
      },
      backgroundColor: {
        'surface': {
          light: '#ffffff',
          dark: '#0f1117', // Slightly darker background
        },
        'card': {
          light: '#ffffff',
          dark: '#1a202c', // Lighter dark for cards
        },
      },
      textColor: {
        'primary': {
          light: '#1a202c',
          dark: '#e2e8f0', // Lighter text in dark mode
        },
      },
      borderColor: {
        'divider': {
          light: '#e2e8f0',
          dark: '#2d3748',
        },
      },
      boxShadow: {
        'dark-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2)',
      },
    },
  },
  plugins: [],
}
