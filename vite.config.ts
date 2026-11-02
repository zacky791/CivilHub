import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
export default defineConfig({
  root: "client",
  envDir: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react()],
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("recharts")) return "charts";
          if (id.includes("leaflet")) return "maps";
        },
      },
    },
  },
});
