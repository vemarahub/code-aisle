import type { NextConfig } from "next";
import { fileURLToPath } from "url";
import { dirname } from "path";

const projectRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Pin the workspace root to this project so Next doesn't walk up to the
  // home directory (which triggers a lockfile-root warning).
  turbopack: {
    root: projectRoot,
  },
  // The MongoDB driver is a server-only dependency; keep it external to the
  // client bundle so Next never tries to bundle native/optional deps.
  serverExternalPackages: ["mongodb"],
};

export default nextConfig;
