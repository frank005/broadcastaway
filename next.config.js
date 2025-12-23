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
    // Exclude legacy React Router files from build (they're not used in Next.js)
    // These files are in src/pages/ and use react-router-dom which isn't installed
    config.resolve = config.resolve || {};
    config.resolve.alias = config.resolve.alias || {};
    
    // Alias the legacy pages to empty modules to prevent build errors
    config.resolve.alias['./pages/AudiencePage'] = false;
    config.resolve.alias['./pages/BroadcastPage'] = false;
    config.resolve.alias['./pages/LobbyPage'] = false;
    
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

