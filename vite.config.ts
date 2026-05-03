import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: false,
    lib: {
      entry: "main.ts",
      formats: ["cjs"],
      fileName: () => "main.js",
    },
    rollupOptions: {
      external: ["obsidian"],
      output: {
        exports: "default",
      },
    },
    outDir: ".obsidian/plugins/ob-tasker",
    emptyOutDir: false,
  },
});
