import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack is enabled by default in Next.js 15+
  output: 'standalone',

  // 🆕 实验性优化 - 减少包体积
  experimental: {
    // 优化大型库的导入
    optimizePackageImports: [
      'lucide-react',        // 图标库按需导入
      'antd',                // Ant Design 按需导入
      '@ant-design/icons',
      'framer-motion',       // 动画库按需导入
      'date-fns',            // 日期库按需导入
      'highlight.js',        // 代码高亮按需导入
      '@tanstack/react-query',
      '@tanstack/react-virtual',
    ],
  },

  // 🆕 生产环境移除 console.log（保留 error 和 warn）
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production'
      ? { exclude: ['error', 'warn', 'info'] }
      : false,
  },

  // 🆕 静态资源缓存策略
  async headers() {
    const securityHeaders = [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data:",
              "connect-src 'self' https://api.openai.com https://api.anthropic.com https://api.deepseek.com wss://localhost:3001",
              "frame-ancestors 'none'",
              "form-action 'self'",
            ].join('; ')
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          }
        ]
      },
      {
        // API 路由的额外头部
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Credentials',
            value: 'true'
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, OPTIONS, PATCH, DELETE, POST, PUT'
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
          }
        ]
      },
      // 🆕 静态资源长期缓存（带 hash 的文件）
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // 🆕 Next.js 图片优化缓存
      {
        source: '/_next/image',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
        ],
      },
      // 🆕 公共静态资源缓存
      {
        source: '/favicon.ico',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400' },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600' },
        ],
      },
    ];

    return securityHeaders;
  },

  // 图片优化配置
  images: {
    formats: ['image/avif', 'image/webp'],
    // 优化设备尺寸列表（减少不必要的图片尺寸）
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    // 🆕 图片缓存时间
    minimumCacheTTL: 86400,
  },
};

// 🆕 Bundle 分析器（仅在 ANALYZE=true 时启用）
let exportConfig = nextConfig;
if (process.env.ANALYZE === 'true') {
  // 动态导入分析器，避免生产依赖
  try {
    const withBundleAnalyzer = require('@next/bundle-analyzer')({
      enabled: true,
      openAnalyzer: false, // 不自动打开浏览器
    });
    exportConfig = withBundleAnalyzer(nextConfig);
  } catch (e) {
    console.warn('Bundle analyzer not installed, skipping...');
  }
}

export default exportConfig;
