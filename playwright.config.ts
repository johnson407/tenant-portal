import { defineConfig, devices } from "@playwright/test";

/**
 * Browser checks run against an already-running server:
 *
 *   npx playwright install --with-deps chromium
 *   BASE_URL=http://localhost:3000 ROOM_CODE_A=... ADMIN_PASSWORD=... \
 *     npx playwright test
 *
 * The target server needs its normal SESSION_SECRET, Redis, room code hashes,
 * and ADMIN_PASSWORD configuration. This is a local diagnostic, separate from
 * the vitest unit suite.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
