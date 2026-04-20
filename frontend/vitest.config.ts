import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Vitest configuration for the Wryte frontend.
 *
 * - `jsdom` is needed because smart-paste uses DOMParser for HTML
 *   sanitization.
 * - The `@` alias mirrors tsconfig.json so imports like `@/lib/utils`
 *   resolve during tests.
 */
export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["lib/**/*.test.ts", "lib/**/*.test.tsx", "components/**/*.test.tsx"],
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
