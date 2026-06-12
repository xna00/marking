#!/usr/bin/env node
import { build } from "vite";
// @ts-ignore
import fs from "fs";
// @ts-ignore
import process from "process";
import manifest from "../extension/manifest.json" with { type: "json" };
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react";

const minify = true;

process.chdir("extension");

await build({
  define: {
    'import.meta.env.VITE_EXTENSION_VERSION': JSON.stringify(manifest.version),
  },
  plugins: [tailwindcss({}), 
  //   react(
  //   {
  //     babel: {
  //       plugins: ['babel-plugin-react-compiler']
  //     }
  //   }
  // )
],
  base: "./",
  mode: process.env.NODE_ENV || "development",
  build: {
    outDir: "../dist/extension",
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

await build({
  define: {
    'import.meta.env.VITE_EXTENSION_VERSION': JSON.stringify(manifest.version),
  },
  build: {
    outDir: "../dist/extension",
    emptyOutDir: false,
    minify,
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

fs.copyFileSync("manifest.json", "../dist/extension/manifest.json");

const popupHtml = fs
  .readFileSync("../dist/extension/popup.html", "utf-8")
  .replace("<title>改卷仙人</title>", `<title>改卷仙人 v${manifest.version}</title>`);
fs.writeFileSync("../dist/extension/popup.html", popupHtml);

process.chdir("../doc");

// fs.copyFileSync("MarkingMaster.exe", "../dist/doc/MarkingMaster.exe");

await build({
  base: "./",
  plugins: [react()],
  build: {
    outDir: "../dist/doc",
    emptyOutDir: true,
    minify,
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
