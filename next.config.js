/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  compress: true,

  images: {
    domains: [],
    dangerouslyAllowSVG: false,
    contentDispositionType: 'attachment',
  },

  // Headers de seguridad adicionales (complementan el middleware)
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options',           value: 'DENY' },
          { key: 'X-Content-Type-Options',     value: 'nosniff' },
          { key: 'X-XSS-Protection',           value: '1; mode=block' },
          { key: 'Referrer-Policy',            value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',         value: 'camera=(), microphone=(), geolocation=(), payment=()' },
        ],
      },
      {
        // No cachear rutas del panel admin
        source: '/admin/:path*',
        headers: [
          { key: 'Cache-Control',  value: 'no-store, no-cache, must-revalidate, proxy-revalidate' },
          { key: 'Pragma',         value: 'no-cache' },
          { key: 'Expires',        value: '0' },
          { key: 'Surrogate-Control', value: 'no-store' },
        ],
      },
      {
        // No cachear respuestas de la API
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
        ],
      },
      {
        // Cachear archivos geográficos estáticos por 24h
        source: '/geo/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, immutable' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
