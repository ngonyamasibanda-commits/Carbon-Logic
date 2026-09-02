import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#0E1117',
        card: '#161A22',
        foreground: '#FAFAFA',
        muted: '#1F2937',
        border: '#333333',
        primary: '#64748B',
        secondary: '#475569',
        accent: '#10B981',
        destructive: '#EF4444',
        warning: '#F59E0B',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Roboto', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
