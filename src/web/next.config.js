// @next/bundle-analyzer version: ^14.0.0
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React strict mode for enhanced development checks
  reactStrictMode: true,

  // Disable X-Powered-By header for security
  poweredByHeader: false,

  // Environment variables exposed to the client
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
    NEXT_PUBLIC_CDN_URL: process.env.NEXT_PUBLIC_CDN_URL,
  },

  // Image optimization configuration
  images: {
    domains: ['storage.googleapis.com'],
    deviceSizes: [320, 480, 640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60,
  },

  // Security headers configuration
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: http:; font-src 'self' data:; connect-src 'self' https://*.googleapis.com wss:",
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ]
  },

  // Webpack configuration for optimization
  webpack: (config, { dev, isServer }) => {
    // Production optimizations
    if (!dev) {
      config.optimization = {
        splitChunks: {
          chunks: 'all',
          minSize: 20000,
          maxSize: 244000,
          minChunks: 1,
          maxAsyncRequests: 30,
          maxInitialRequests: 30,
          cacheGroups: {
            default: false,
            vendors: false,
            framework: {
              chunks: 'all',
              name: 'framework',
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler|prop-types|use-subscription)[\\/]/,
              priority: 40,
              enforce: true,
            },
            lib: {
              test: /[\\/]node_modules[\\/]/,
              name: 'lib',
              priority: 30,
              minChunks: 2,
              reuseExistingChunk: true,
            },
          },
        },
        runtimeChunk: {
          name: 'runtime',
        },
      }

      config.performance = {
        hints: 'warning',
        maxEntrypointSize: 400000,
        maxAssetSize: 400000,
      }
    }

    return config
  },

  // Experimental features
  experimental: {
    optimizeCss: true,
    scrollRestoration: true,
    optimisticClientCache: true,
    serverActions: true,
    serverComponentsExternalPackages: [],
  },

  // Enable compression
  compress: true,

  // Disable source maps in production
  productionBrowserSourceMaps: false,

  // Enable SWC minification
  swcMinify: true,

  // Remove console logs in production
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // Development indicators
  devIndicators: {
    buildActivity: true,
    buildActivityPosition: 'bottom-right',
  },
}

// Export configuration with bundle analyzer wrapper
module.exports = withBundleAnalyzer(nextConfig)