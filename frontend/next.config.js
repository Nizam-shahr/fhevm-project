/** @type {import('next').NextConfig} */

import webpack from "webpack";

const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
    };

    // ✅ Polyfill "global" for browser
    config.plugins.push(
      new webpack.ProvidePlugin({
        global: require.resolve("global"),
      })
    );

    return config;
  },
};

export default nextConfig;
