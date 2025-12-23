/** @type {import('next').NextConfig} */
const nextConfig = {
  // For Netlify deployment - use default output (not standalone)
  // Netlify plugin handles Next.js automatically
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  // Allow importing CommonJS modules
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Allow dynamic requires for token builder utilities
      config.module = config.module || {};
      config.module.unknownContextCritical = false;
      config.module.unknownContextRegExp = /^\.\/.*$/;
      config.module.unknownContextRequest = '.';
      
      // Don't externalize token builder utils - we need them bundled
      config.externals = config.externals || [];
    }
    return config;
  },
}

module.exports = nextConfig

