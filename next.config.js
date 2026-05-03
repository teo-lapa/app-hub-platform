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
  experimental: {
    // LAPA WINE: forza l'inclusione del catalogo Vergani (JSON 2KB+) negli output bundle delle route
    // serverless, altrimenti `readFileSync('prisma/seed-data/lapa-wine-vini.json')` fallisce su Vercel.
    outputFileTracingIncludes: {
      '/api/wine/sommelier': ['./prisma/seed-data/lapa-wine-vini.json'],
      '/api/wine/catalog': ['./prisma/seed-data/lapa-wine-vini.json'],
    },
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