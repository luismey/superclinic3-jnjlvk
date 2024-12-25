import type { Config } from 'tailwindcss/types'
import { defaultTheme } from 'tailwindcss/defaultTheme' // v3.3.0
import { theme } from './src/config/theme'

const config: Config = {
  // Content paths for JIT compilation
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],

  // Theme configuration extending Tailwind defaults
  theme: {
    extend: {
      // Color system with semantic tokens and WCAG AA compliance
      colors: {
        ...theme.colors,
        current: 'currentColor',
        transparent: 'transparent',
      },

      // Typography system with Inter font
      fontFamily: {
        sans: theme.typography.fontFamily.primary,
        mono: theme.typography.fontFamily.mono,
      },

      // Font sizes with consistent scale
      fontSize: theme.typography.sizes,

      // Font weights
      fontWeight: theme.typography.fontWeight,

      // Line heights
      lineHeight: theme.typography.lineHeight,

      // Letter spacing
      letterSpacing: theme.typography.letterSpacing,

      // 4px/8px grid spacing system
      spacing: theme.spacing,

      // Responsive breakpoints
      screens: {
        mobile: theme.breakpoints.mobile,
        tablet: theme.breakpoints.tablet,
        desktop: theme.breakpoints.desktop,
        wide: theme.breakpoints.wide,
        ultrawide: theme.breakpoints.ultrawide,
      },

      // Elevation system
      boxShadow: theme.shadows,

      // Border radius system
      borderRadius: theme.radii,
    },
  },

  // Plugin configuration
  plugins: [
    require('@tailwindcss/forms')({
      strategy: 'class',
    }),
    require('@tailwindcss/typography'),
    require('@tailwindcss/aspect-ratio'),
  ],

  // Critical utility classes that should not be purged
  safelist: [
    // Interactive states
    'hover:bg-primary-600',
    'focus:ring-primary-500',
    'active:bg-primary-700',
    
    // Semantic colors
    'text-semantic-success',
    'text-semantic-warning',
    'text-semantic-error',
    'text-semantic-info',
    
    // Accessibility
    'focus:outline-none',
    'focus:ring-2',
    'focus:ring-offset-2',
    
    // Responsive utilities
    'mobile:text-sm',
    'tablet:text-base',
    'desktop:text-lg',
  ],
}

export default config