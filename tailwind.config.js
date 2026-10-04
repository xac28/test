/** @type {import('tailwindcss').Config} */
//
// AYA design tokens — "editorial" identity: warm paper, ink-black type, one terracotta accent.
// Component classes still say `sage-*` / `clay-*` / `cream` (historical names): `sage` is now the
// warm stone/ink neutral scale, `clay` the terracotta accent scale, `cream` the paper colour.
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
      },
      colors: {
        sage: {
          50: '#f8f6f1',
          100: '#efebe2',
          200: '#e0dacb',
          300: '#c7bfab',
          400: '#a39a84',
          500: '#7e7562',
          600: '#5c5445',
          700: '#3f392f',
          800: '#2a261f',
          900: '#1b1813',
        },
        clay: {
          50: '#fbf1eb',
          100: '#f6dfd2',
          200: '#edbfa6',
          300: '#e09a76',
          400: '#cf7549',
          500: '#b9572b',
          600: '#9e4521',
          700: '#7f371b',
        },
        cream: '#f6f2ea',
        paper: '#fbf9f4',
        rule: '#d9d2c3',
        ink: '#17140f',
        // live broadcast UI (dark "stage")
        stage: { DEFAULT: '#100f0d', 2: '#1a1815', 3: '#25221e' },
        accent: { DEFAULT: '#c2410c', dark: '#9a3412' },
      },
      // Flatter, more architectural corners than the rounded "app" look
      borderRadius: {
        lg: '4px',
        xl: '6px',
        '2xl': '8px',
        '3xl': '10px',
        '[2rem]': '12px',
      },
      boxShadow: {
        sm: '0 1px 0 rgba(23,20,15,0.04)',
        DEFAULT: '0 1px 2px rgba(23,20,15,0.06)',
        md: '0 2px 8px -2px rgba(23,20,15,0.10)',
        lg: '0 8px 24px -8px rgba(23,20,15,0.14)',
        xl: '0 16px 40px -12px rgba(23,20,15,0.18)',
        '2xl': '0 24px 56px -16px rgba(23,20,15,0.22)',
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
