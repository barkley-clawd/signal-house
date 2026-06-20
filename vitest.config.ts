import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "frontend/src"),
    },
  },
  test: {
    include: ["server/**/*.test.ts", "frontend/src/**/*.test.ts", "frontend/src/**/*.test.tsx"],
  },
});
