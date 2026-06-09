/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@ahmadtanveer44/neura-annotation-canvas"],

  // Turbopack (Next.js 16 default): force konva's browser CJS build so the
  // server side never tries to require('canvas').
  turbopack: {
    resolveAlias: {
      konva: "konva/lib/index.js",
    },
  },

  // Keep webpack config for `next build` (--webpack mode).
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        konva: require.resolve("konva/lib/index.js"),
      };
    }
    return config;
  },
};

module.exports = nextConfig;
