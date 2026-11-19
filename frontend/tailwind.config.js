/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope', 'sans-serif'],
        serif: ['Playfair Display', 'serif'],
        display: ['Marthin Slant', 'cursive'],
        // Tipografía del rediseño: se aplica por clase (font-cormorant)
        // para no cambiar los títulos existentes que usan Playfair.
        cormorant: ['Cormorant Garamond', 'serif'],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // Tokens del rediseño: bg-panel, text-vpm-muted, border-vpm-accent, etc.
        vpm: {
          bg: 'var(--vpm-bg)',
          panel: 'var(--vpm-panel)',
          'panel-2': 'var(--vpm-panel-2)',
          field: 'var(--vpm-field)',
          border: 'var(--vpm-border)',
          'border-strong': 'var(--vpm-border-strong)',
          text: 'var(--vpm-text)',
          muted: 'var(--vpm-muted)',
          faint: 'var(--vpm-faint)',
          accent: 'var(--vpm-accent)',
          'accent-hover': 'var(--vpm-accent-hover)',
          'accent-soft': 'var(--vpm-accent-soft)',
          pos: 'var(--vpm-pos)',
          neg: 'var(--vpm-neg)',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}