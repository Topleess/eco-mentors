module.exports = {
  content: [
    './src/components/**/*.{js,ts,jsx,tsx}',
    './src/features/**/*.{js,ts,jsx,tsx}',
    './src/pages/**/*.{js,ts,jsx,tsx}',
    './src/lib/**/*.{js,ts,jsx,tsx}',
    './src/types/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'media', // or 'media' or 'class'
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: '1rem',
        sm: '2rem',
      },
    },

    fontFamily: {
      sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
      display: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
      name: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
      mono: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
    },

    extend: {
      colors: {
        ink: '#000000',
        'ink-soft': '#3F4A3D',
        'ink-mute': '#344431',
        'ink-faint': '#899586',
        surface: '#F4FAF2',
        'surface-deep': '#E3F0DF',
        line: '#D1DFCD',
        danger: '#B42318',
        'mint-ink': '#246B20',
        brand: {
          green: '#70E852',
          'light-green': '#C9FFBF',
          'dark-green': '#246B20',
          navy: '#000000',
          cobalt: '#246B20',
          mint: '#70E852',
        },
        pastel: {
          sky: { DEFAULT: '#C9FFBF', deep: '#B4F5A7' },
          sand: { DEFAULT: '#E5FFDF', deep: '#C9FFBF' },
          sage: { DEFAULT: '#C9FFBF', deep: '#B4F5A7' },
          lavender: { DEFAULT: '#D9F5D3', deep: '#C6E9BF' },
          rose: { DEFAULT: '#ECF8E8', deep: '#D9F5D3' },
        },
      },

      borderRadius: {
        field: '12px',
        card: '14px',
        btn: '14px',
        panel: '16px',
      },

      boxShadow: {
        btn: '2px 2px 0 rgb(36 107 32 / 0.4)',
        'btn-hover': '4px 4px 0 rgb(36 107 32 / 0.4)',
        'card-hover': '0 12px 26px -10px rgb(0 0 0 / 0.22)',
        dropdown: '0 16px 36px -12px rgb(0 0 0 / 0.25)',
        'focus-field': '0 0 0 3px rgb(36 107 32 / 0.13)',
        'focus-ring': '0 0 0 3px #fff, 0 0 0 5.5px #246B20',
      },

      backgroundImage: {
        'pastel-sky-grad': 'linear-gradient(180deg,#C9FFBF 0%,#B4F5A7 100%)',
        'pastel-sand-grad': 'linear-gradient(180deg,#E5FFDF 0%,#C9FFBF 100%)',
        'pastel-sage-grad': 'linear-gradient(180deg,#C9FFBF 0%,#B4F5A7 100%)',
        'pastel-lavender-grad': 'linear-gradient(180deg,#D9F5D3 0%,#C6E9BF 100%)',
        'pastel-rose-grad': 'linear-gradient(180deg,#ECF8E8 0%,#D9F5D3 100%)',
        'pastel-neutral-grad': 'linear-gradient(180deg,#F4FAF2 0%,#E3F0DF 100%)',
        shimmer: 'linear-gradient(90deg,#F4FAF2 25%,#E3F0DF 50%,#F4FAF2 75%)',
      },

      transitionDuration: {
        120: '120ms',
        180: '180ms',
        240: '240ms',
      },
      transitionTimingFunction: {
        pop: 'cubic-bezier(.34,1.56,.64,1)',
      },
      keyframes: {
        'rise-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          from: { backgroundPosition: '200% 0' },
          to: { backgroundPosition: '-200% 0' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%, 60%': { transform: 'translateX(-3px)' },
          '40%, 80%': { transform: 'translateX(3px)' },
        },
        'toast-in': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'dropdown-in': {
          from: { opacity: '0', transform: 'translateY(-6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'rise-in': 'rise-in 240ms ease-out both',
        shimmer: 'shimmer 1.4s linear infinite',
        shake: 'shake 200ms ease-in-out',
        'toast-in': 'toast-in 240ms ease-out both',
        'dropdown-in': 'dropdown-in 140ms ease-out both',
      },
    },
  },
  variants: {
    extend: {},
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/aspect-ratio'),
  ],
}
