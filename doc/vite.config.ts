import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss({})],
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
        // --imm-- 是给服务端的标记，真正的保证来自 [hash]：内容不变文件名就不变，
        // 所以同名文件的字节永远相同，可以永久缓存
        entryFileNames: "[name]--imm--[hash].js",
        chunkFileNames: "[name]--imm--[hash].js",
        assetFileNames: "[name]--imm--[hash][extname]",
      },
    },
  },
});
