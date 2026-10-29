#!/usr/bin/env node
/// <reference types="node" />

// 用 Vite JS API 跑两次 build，取代原来的 vite.config.ts + vite.content.config.ts：
// - 第一次：popup + background（会清空产物目录）
// - 第二次：content 独立打包
//
// content 为什么必须单独 build：content_scripts 按经典脚本加载，不能出现 ESM import。
// 若和 popup/background 并进同一个多 entry build，rollup 会为共享模块自动拆出 chunk，
// content.js 里就会产生 import，运行时直接报 "Cannot use import statement outside a module"。
// 拆成两次 build（content 单 entry）后，rollup 不会 code split，产物天然自包含。

import { build } from "vite";
import tailwindcss from "@tailwindcss/vite";
import manifest from "../manifest.json" with { type: "json" };

// root 固定为 extension 目录，避免从别处执行时路径错乱
const root = new URL("..", import.meta.url).pathname;
const outDir = "../dist/extension";

// 第一次：popup + background
await build({
  configFile: false,
  root,
  define: {
    "import.meta.env.VITE_EXTENSION_VERSION": JSON.stringify(manifest.version),
  },
  plugins: [tailwindcss({})],
  base: "./",
  build: {
    outDir,
    emptyOutDir: true,
    minify: true,
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

// 第二次：content 单独打包（经典脚本，不能继承 manualChunks；目录已由上一次清空，这里不能清）
await build({
  configFile: false,
  root,
  build: {
    outDir,
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
