import { defineConfig } from "vitest/config";

export default defineConfig({
  // Port is FIXED: the measurement URLs in the README point at this exact address.
  // If the port is taken, Vite errors out instead of walking up to the next one.
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  build: { target: "esnext" },
  test: { environment: "node", include: ["test/**/*.test.ts"] },
});
