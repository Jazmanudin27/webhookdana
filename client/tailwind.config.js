/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dana: {
          blue: '#108ee9',
          darkBlue: '#0c6cbd',
          lightBlue: '#e6f4ff',
          navy: '#0b192c'
        }
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'wave': 'wave 2.5s ease-in-out infinite alternate',
        'flow': 'flow 1s linear infinite',
      },
      keyframes: {
        wave: {
          '0%': { transform: 'translateY(0px) rotate(0deg)' },
          '100%': { transform: 'translateY(-6px) rotate(1deg)' },
        },
        flow: {
          '0%': { backgroundPosition: '0 0' },
          '100%': { backgroundPosition: '40px 0' },
        }
      }
    },
  },
  plugins: [],
}
