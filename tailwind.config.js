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
        // neutrals with a hint of teal ("stone")
        sage: {
          50: '#f4f7fb',
          100: '#e7eef6',
          200: '#d3dde9',
          300: '#b3c2d4',
          400: '#8296ad',
          500: '#5a6f87',
          600: '#445b75',
          700: '#1f3d5f',
          800: '#16304f',
          900: '#0d213a',
        },
        // warm coral: the accent for calls to action
        clay: {
          50: '#eef5fe',
          100: '#dcebfc',
          200: '#c4dcfa',
          300: '#93bff4',
          400: '#5b9cef',
          500: '#2f7de1',
          600: '#1f62bf',
          700: '#184c97',
        },
        // deep lagoon teal: brand colour for primary surfaces and links
        teal: {
          50: '#eaf3fc',
          100: '#d2e6f9',
          200: '#a6cdf1',
          300: '#74afe6',
          400: '#3f88d4',
          500: '#2569b5',
          600: '#1c5496',
          700: '#17447a',
          800: '#133663',
          900: '#0e2850',
        },
        saffron: { 100: '#def2fc', 200: '#b8e2f8', 300: '#8fd0f3', 400: '#5ab9ec', 500: '#2ea1e0', 600: '#1b82bd' },
        lotus: { 100: '#f9e3ea', 200: '#f2c4d3', 300: '#e89bb5', 400: '#d96f93', 500: '#c24d77' },
        lilac: { 100: '#ece7f7', 200: '#d8cef0', 300: '#bba9e4', 400: '#9a84d3', 500: '#7b63bd' },
        cream: '#f2f7fd',
        paper: '#ffffff',
        rule: '#d4e3f3',
        ink: '#0c2a4a',
        // live broadcast UI (dark "stage")
        stage: { DEFAULT: '#0a1a30', 2: '#112643', 3: '#19345a' },
        accent: { DEFAULT: '#2f7de1', dark: '#1f62bf' },
      },
      // Flatter, more architectural corners than the rounded "app" look
      borderRadius: {
        lg: '8px',
        xl: '12px',
        '2xl': '16px',
        '3xl': '22px',
        '[2rem]': '28px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(12,42,74,0.06)',
        DEFAULT: '0 1px 3px rgba(12,42,74,0.08), 0 1px 2px rgba(12,42,74,0.05)',
        md: '0 4px 14px -4px rgba(12,42,74,0.12)',
        lg: '0 12px 28px -10px rgba(12,42,74,0.16)',
        xl: '0 20px 44px -14px rgba(12,42,74,0.2)',
        '2xl': '0 28px 60px -18px rgba(12,42,74,0.26)',
        glow: '0 10px 30px -8px rgba(47,125,225,0.45)',
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
