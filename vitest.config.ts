import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  // Force React's development build under jsdom so React.act is available
  // (Vite's dep optimizer otherwise inlines the production build).
  define: { "process.env.NODE_ENV": '"test"' },
  optimizeDeps: {
    esbuildOptions: { define: { "process.env.NODE_ENV": '"test"' } },
  },
  test: {
    env: { TZ: "UTC" },
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["lib/**", "app/actions.ts", "components/**"],
      exclude: ["components/ui/chart.tsx"],
    },
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: [
            "test/unit/**/*.test.ts",
            "test/integration/**/*.test.ts",
          ],
          setupFiles: ["test/setup.node.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "dom",
          environment: "jsdom",
          include: [
            "test/component/**/*.test.tsx",
            "test/snapshot/**/*.test.tsx",
          ],
          setupFiles: ["test/setup.dom.ts"],
        },
      },
    ],
  },
});
