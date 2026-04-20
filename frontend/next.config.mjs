/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  env: {
    // NEXT_PUBLIC_API_URL is read directly by the client via process.env.
  },
};

export default nextConfig;
