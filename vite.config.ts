import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // Relative base so the build works on GitHub Pages subpaths (/repo-name/)
  // without needing to know the repo name up front.
  base: "./",
  plugins: [react(), tailwindcss()],
  server: { host: true, port: 5180 },
  build: { outDir: "dist", chunkSizeWarningLimit: 1500 }
});
