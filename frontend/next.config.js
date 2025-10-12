/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:54112/api/:path*',
      },
    ];
  },
  images: {
    domains: ['res.cloudinary.com'], // For Cloudinary CDN
  },
};

module.exports = nextConfig;