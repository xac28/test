import { defineConfig } from "vitest/config"
import path from "path"

// API integration tests: need the dev/prod server on BASE_URL and the DB from .env
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "node",
    include: ["tests/api/**/*.test.ts"],
    testTimeout: 30000,
    fileParallelism: false,
    setupFiles: ["tests/api/env.ts"],
  },
})
