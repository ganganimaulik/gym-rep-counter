/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    externalDir: true,
  },
  async rewrites() {
    return [
      {
        source: '/.well-known/oauth-protected-resource',
        destination: '/api/well-known/oauth-protected-resource',
      },
      {
        source: '/.well-known/oauth-authorization-server',
        destination: '/api/well-known/oauth-authorization-server',
      },
      {
        source: '/mcp',
        destination: '/api/mcp',
      },
      {
        source: '/sse',
        destination: '/api/sse',
      },
      {
        source: '/message',
        destination: '/api/message',
      },
    ]
  },
}
module.exports = nextConfig
