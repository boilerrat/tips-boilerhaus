import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        // IBM Plex Mono for addresses and code elements
        mono: ['IBM Plex Mono', 'monospace'],
        // Inter for all UI copy
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Protocol brand tokens — extend when design direction is settled
      },
    },
  },
  plugins: [],
}

export default config
