import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import manifest from "./manifest.json" with { type: "json" };

const minify = true;

// content script 由 vite.content.config.ts 单独打包，见那里注释
export default defineConfig({
  define: {
    "import.meta.env.VITE_EXTENSION_VERSION": JSON.stringify(manifest.version),
  },
  plugins: [
    tailwindcss({}),
    // react({
    //   babel: { plugins: ["babel-plugin-react-compiler"] },
    // })
  ],
  base: "./",
  build: {
    outDir: "../dist/extension",
    emptyOutDir: true,
    minify,
    modulePreload: false,
    assetsDir: ".",
    rollupOptions: {
      input: {
        popup: "popup.html",
        background: "background.ts",
      },
      output: {
        entryFileNames: "[name].js",
        manualChunks: {
          vendor: ["react", "react-dom/client"],
        },
      },
    },
  },
});
