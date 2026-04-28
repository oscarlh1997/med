import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#F5EFE3',
        card: '#FBF7EF',
        ink: '#1F1D1A',
        muted: '#7A7166',
        sage: '#1F3A2E',
        sageDeep: '#0F2A1F',
        sageSoft: '#9DB8A5',
        ok: '#2F5C40',
        amber: '#A06A1F',
        amberSoft: '#FBEFD8',
        danger: '#7A2A20',
        border: '#E5DDC9',
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Manrope', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
