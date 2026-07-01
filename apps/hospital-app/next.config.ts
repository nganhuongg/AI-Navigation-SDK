import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Declare the monorepo root so Turbopack resolves workspace packages correctly.
  turbopack: {
    root: path.resolve(__dirname, "../.."),
  },
};

export default nextConfig;
