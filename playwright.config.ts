import { defineConfig } from "@playwright/test";

// Runs the core journey in a phone-sized Chrome window against the dev server. The recognizer is stubbed in the
// test, so no model key is needed. Uses the installed Google Chrome; set PW_CHANNEL="" to use Playwright's Chromium.
export default defineConfig({
  testDir: "tests",
  testMatch: "*.spec.ts",
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:5174",
    channel: process.env.PW_CHANNEL ?? "chrome",
    viewport: { width: 390, height: 844 },
    colorScheme: "dark",
  },
  webServer: {
    command: "npx vite --port 5174 --strictPort",
    url: "http://localhost:5174",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
