import fs from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

// Next.js carga .env.local automáticamente para la app; los tests lo necesitan también
// (para el cliente admin de tests/e2e/helpers.ts), pero Playwright no lo hace por su cuenta.
const envLocalPath = path.resolve(__dirname, ".env.local");
if (fs.existsSync(envLocalPath)) {
  for (const line of fs.readFileSync(envLocalPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2];
    }
  }
}

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium-touch",
      use: { ...devices["Pixel 7"] },
    },
  ],
});
