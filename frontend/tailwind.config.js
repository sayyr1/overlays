/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: 'rgb(var(--color-brand, 15 118 110) / <alpha-value>)',
          dark: 'rgb(var(--color-brand-dark, 13 79 71) / <alpha-value>)',
          light: 'rgb(var(--color-brand-light, 20 184 166) / <alpha-value>)',
          muted: 'rgb(var(--color-brand-muted, 56 173 169) / <alpha-value>)'
        },
        accent: {
          DEFAULT: 'rgb(var(--color-accent, 249 115 22) / <alpha-value>)',
          soft: 'rgb(var(--color-accent-soft, 255 182 119) / <alpha-value>)'
        },
        surface: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5f5'
        }
      },
      fontFamily: {
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
        display: ['var(--font-heading)', '"Times New Roman"', 'serif']
      },
      boxShadow: {
        'brand-sm': '0 12px 30px -20px rgba(15, 118, 110, 0.35)',
        'brand-md': '0 25px 45px -25px rgba(15, 118, 110, 0.35)',
        'card-lg': '0 28px 60px -40px rgba(15, 23, 42, 0.45)'
      },
      borderRadius: {
        '2xl': '1.25rem',
        '3xl': '2rem'
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #0f766e 0%, #0ea5e9 40%, #111827 100%)',
        'hero-radial': 'radial-gradient(circle at top right, rgba(14,165,233,0.25), transparent 55%)'
      },
      spacing: {
        '18': '4.5rem'
      }
    },
    container: {
      center: true,
      padding: {
        DEFAULT: '1rem',
        sm: '2rem',
        lg: '4rem',
        xl: '5rem',
        '2xl': '6rem',
      },
    },
  },
  plugins: [],
}
