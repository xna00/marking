import { defineConfig } from "vite";

// content script 必须独立打包：manifest.json 以经典脚本方式加载它，不能出现 ESM import。
// 所以不能和 popup/background 合并成一个 build —— 合并会继承下面的 manualChunks，
// 产出 content.js + vendor.js，content.js 里的 import 在 content script 环境里无法解析。
export default defineConfig({
  build: {
    outDir: "../dist/extension",
    // 上一个 build 已经 emptyOutDir 清空过，这里必须关掉，否则会清掉它的产物
    emptyOutDir: false,
    minify: true,
    rollupOptions: {
      input: {
        content: "content.ts",
      },
      output: {
        entryFileNames: "[name].js",
      },
    },
  },
});
