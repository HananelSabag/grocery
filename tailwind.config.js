/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // One brand colour, used for anything actionable. Green reads as
        // "fresh / groceries" and keeps the checked-off state (also green)
        // feeling like the same system rather than a second palette.
        // Straight off the logo: the cart is navy, the two linked rings
        // are these blues. Nothing in the UI invents a colour outside it.
        brand: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#4a96f4',
          500: '#3b82f6',
          600: '#2864ef',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#17325c',
        },
      },
      fontFamily: {
        // Hebrew first: Rubik covers he+en with one metric, so switching
        // language never reflows the layout.
        sans: ['Rubik', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      spacing: {
        // The iOS/Android home indicator and the notch. Used by the composer
        // and the bottom bar so nothing sits under the system chrome.
        'safe-b': 'env(safe-area-inset-bottom)',
        'safe-t': 'env(safe-area-inset-top)',
      },
      minHeight: {
        // The 44px touch minimum, as a named token so rows can't drift below it.
        touch: '44px',
      },
      animation: {
        'slide-up': 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-in': 'fadeIn 0.15s ease-out',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
