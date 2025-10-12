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