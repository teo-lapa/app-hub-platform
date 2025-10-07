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
    outputFileTracingExcludes: {
      '*': [
        'node_modules/@img/sharp-*',
      ],
    },
  },
  // Configure sharp for serverless
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push('sharp');
    }
    return config;
  },
}

module.exports = nextConfig