/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  images: {
    domains: [],
  },
  // Optimize serverless function size for Vercel
  experimental: {
    outputFileTracingExcludes: {
      '*': [
        'node_modules/@swc/core-linux-x64-gnu',
        'node_modules/@swc/core-linux-x64-musl',
        'node_modules/@esbuild',
        'node_modules/webpack',
        'node_modules/terser',
        '.git/**',
        '.next/cache/**',
      ],
    },
  },
  // Sharp configuration for Vercel serverless
  serverExternalPackages: ['sharp'],
  async rewrites() {
    // Proxy per chiamate Odoo durante lo sviluppo
    const odooUrl = process.env.NEXT_PUBLIC_ODOO_URL || 'https://lapadevadmin-lapa-v2-staging-2406-24063382.dev.odoo.com';
    return [
      {
        source: '/web/:path*',
        destination: `${odooUrl}/web/:path*`,
      },
    ];
  },
}

module.exports = nextConfig