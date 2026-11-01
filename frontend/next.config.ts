import type { NextConfig } from "next";

// In production nginx sends /api to the backend directly. The rewrite covers
// `next dev` and running the frontend on its own.
const backend = process.env.NEXUS_BACKEND_URL ?? "http://127.0.0.1:8000";

const config: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${backend}/api/:path*` },
      { source: "/llm/:path*", destination: `${process.env.NEXUS_LLM_URL ?? "http://127.0.0.1:11434"}/:path*` },
    ];
  },
};

export default config;
