import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'export',   // generates static HTML/CSS/JS — no server needed
  trailingSlash: true,
}

export default nextConfig
