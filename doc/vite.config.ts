import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss({})],
  server: {
    // app 里 createHandler("/api") 用的是相对路径，dev 下必须代理到后端，否则打到 vite 自己
    proxy: {
      "/api": {
        // 默认直连线上后端；要连本地 server 时 API_TARGET=http://localhost:3000 npm run dev
        target: process.env.API_TARGET ?? "https://marking.112287.xyz",
        // 让后端收到的 Host 是目标域名，避免按 vhost 分流时 404
        changeOrigin: true,
      },
    },
  },
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
