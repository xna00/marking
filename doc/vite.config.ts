import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: "../dist/doc",
    emptyOutDir: true,
    minify: true,
    modulePreload: false,
    assetsDir: ".",
    rollupOptions: {
      input: {
        doc: "index.html",
        app: "app/index.html",
        test: "test/index.html",
        multi: "test/multi.html",
      },
      output: {
        assetFileNames: "[name][extname]",
        // entryFileNames: "[name].js",
      },
    },
  },
});
