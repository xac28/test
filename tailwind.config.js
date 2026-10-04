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
          50: '#f6f6f1',
          100: '#ecece4',
          200: '#dbdbcf',
          300: '#bfc0b2',
          400: '#999b8d',
          500: '#6a7068',
          600: '#525a56',
          700: '#2d4a4c',
          800: '#1d3739',
          900: '#12272b',
        },
        // warm coral: the accent for calls to action
        clay: {
          50: '#fef3ee',
          100: '#fce6dc',
          200: '#f9cdbb',
          300: '#f4a58a',
          400: '#ee8466',
          500: '#e2684a',
          600: '#c94e32',
          700: '#a53d27',
        },
        // deep lagoon teal: brand colour for primary surfaces and links
        teal: {
          50: '#eef7f6',
          100: '#d6ece9',
          200: '#aedbd5',
          300: '#7bc2ba',
          400: '#47a39a',
          500: '#2a857d',
          600: '#1f6b66',
          700: '#1a5652',
          800: '#17433f',
          900: '#12302e',
        },
        saffron: { 100: '#fdf0cf', 200: '#fbe29b', 300: '#f7cf66', 400: '#f2bb3a', 500: '#e5a21d', 600: '#c0820f' },
        lotus: { 100: '#f9e3ea', 200: '#f2c4d3', 300: '#e89bb5', 400: '#d96f93', 500: '#c24d77' },
        lilac: { 100: '#ece7f7', 200: '#d8cef0', 300: '#bba9e4', 400: '#9a84d3', 500: '#7b63bd' },
        cream: '#fbf6ee',
        paper: '#fffdf9',
        rule: '#e4dccd',
        ink: '#17313a',
        // live broadcast UI (dark "stage")
        stage: { DEFAULT: '#0e1b1d', 2: '#162729', 3: '#1f3436' },
        accent: { DEFAULT: '#e2684a', dark: '#c94e32' },
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
        sm: '0 1px 2px rgba(23,49,58,0.06)',
        DEFAULT: '0 1px 3px rgba(23,49,58,0.08), 0 1px 2px rgba(23,49,58,0.05)',
        md: '0 4px 14px -4px rgba(23,49,58,0.12)',
        lg: '0 12px 28px -10px rgba(23,49,58,0.16)',
        xl: '0 20px 44px -14px rgba(23,49,58,0.2)',
        '2xl': '0 28px 60px -18px rgba(23,49,58,0.26)',
        glow: '0 10px 30px -8px rgba(226,104,74,0.45)',
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
