import aspectRatio from '@tailwindcss/aspect-ratio';
import { corporateColors } from './src/theme/corporate.js';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        regular: ['Regular', 'sans-serif'],
        bold: ['Bold', 'sans-serif'],
        semibold: ['SemiBold', 'sans-serif'],
      },
      colors: {
        tracsa: {
          principal: {
            DEFAULT: corporateColors.secondary,
            light: corporateColors.secondaryLight
          },
          secundario: {
            DEFAULT: corporateColors.primary,
            light: corporateColors.primaryLight
          },
          cancelar: {
            DEFAULT: corporateColors.error,
            light: corporateColors.errorLight
          },
          neutro: {
            DEFAULT: corporateColors.neutral,
            light: corporateColors.neutralLight
          }
        }
      }
    },
  },
  plugins: [
    aspectRatio
  ],
}
