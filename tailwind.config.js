/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        industrial: {
          950: '#0a0b0d',
          900: '#111317',
          800: '#1a1d24',
          700: '#242933',
          600: '#2e3542',
          500: '#3e4759',
          400: '#5a6882',
          300: '#7e8fa8',
          200: '#a6b5cc',
          100: '#cbd5e1',
        },
        danger: {
          500: '#ef4444',
          600: '#dc2626',
        },
        warning: {
          500: '#f59e0b',
          600: '#d97706',
        },
        success: {
          500: '#10b981',
          600: '#059669',
        },
        info: {
          500: '#3b82f6',
          600: '#2563eb',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Courier New', 'monospace'],
        sans: ['Inter', 'Roboto', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'industrial-inner': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.6)',
        'industrial-glow': '0 0 15px rgba(59, 130, 246, 0.15)',
        'danger-glow': '0 0 15px rgba(239, 68, 68, 0.25)',
        'warning-glow': '0 0 15px rgba(245, 158, 11, 0.25)',
        'success-glow': '0 0 15px rgba(16, 185, 129, 0.25)',
      }
    },
  },
  plugins: [],
}
