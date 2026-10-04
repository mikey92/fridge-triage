import { defineConfig } from "vitest/config";

// Kept apart from vite.config.ts so unit tests run without the Cloudflare plugin.
export default defineConfig({
  test: { include: ["tests/**/*.test.ts"] },
});
