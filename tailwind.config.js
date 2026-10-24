/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#17241f',
        muted: '#75817b',
        canvas: '#f6f7f4',
        forest: '#1f6a50',
        mint: '#e5f2eb',
        line: '#e7ebe7',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        panel: '0 12px 35px rgba(28, 47, 37, 0.06)',
      },
    },
  },
  plugins: [],
};
