/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'serif'],
        body: ['var(--font-body)', 'sans-serif'],
      },
      colors: {
        sage: {
          50: '#f6f8f4',
          100: '#e8eee2',
          200: '#d2dec6',
          300: '#aec39d',
          400: '#88a574',
          500: '#6a8a56',
          600: '#516e42',
          700: '#405736',
          800: '#34462e',
          900: '#2c3b27',
        },
        clay: {
          50: '#faf6f2',
          100: '#f4ebe1',
          200: '#e7d3bf',
          300: '#d6b394',
          400: '#c39068',
          500: '#b6764c',
          600: '#a86340',
          700: '#8b4f37',
        },
        cream: '#faf6f0',
        // live broadcast UI (dark "stage")
        stage: { DEFAULT: '#0e0f0d', 2: '#18191a', 3: '#232522' },
        accent: { DEFAULT: '#c2410c', dark: '#9a3412' },
        ink: '#1a1f1a',
      },
      animation: {
        'fade-up': 'fadeUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'fade-in': 'fadeIn 1s ease forwards',
        'breathe': 'breathe 6s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        breathe: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.4' },
          '50%': { transform: 'scale(1.1)', opacity: '0.6' },
        },
      },
    },
  },
  plugins: [],
};
