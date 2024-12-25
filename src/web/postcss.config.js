// PostCSS configuration for production-ready CSS processing
// tailwindcss v3.3.0
// autoprefixer v10.4.0

/**
 * Creates optimized PostCSS configuration with properly ordered plugins
 * and performance-focused settings for CSS delivery
 */
module.exports = {
  plugins: [
    // Process Tailwind CSS directives and utilities
    require('tailwindcss')({
      // Ensure consistent configuration with design system
      config: require('./tailwind.config'),
    }),

    // Add vendor prefixes for cross-browser compatibility
    require('autoprefixer')({
      // Target modern browsers for optimal prefix generation
      // while maintaining broad compatibility
      flexbox: 'no-2009',
      grid: 'autoplace',
    }),

    // Production optimizations
    process.env.NODE_ENV === 'production' && {
      // Minify CSS in production
      'postcss-minify': {
        preset: ['default', {
          discardComments: {
            removeAll: true,
          },
          normalizeWhitespace: true,
          minifyFontValues: true,
          minifySelectors: true,
        }],
      },
      
      // Merge identical selectors
      'postcss-combine-duplicated-selectors': {
        removeDuplicatedProperties: true,
      },
      
      // Optimize media queries
      'postcss-sort-media-queries': {
        sort: 'mobile-first', // Align with responsive breakpoint strategy
      },
    },
  ].filter(Boolean),

  // Source map configuration for development
  sourceMap: process.env.NODE_ENV !== 'production',
  
  // Enable watching in development for faster rebuilds
  watch: process.env.NODE_ENV === 'development',
  
  // Cache configuration for improved build performance
  cache: true,
  cacheInclude: [
    /.*\.css$/,
    /.*\.scss$/,
    /tailwind\.config\.(js|ts)$/,
  ],
}