#!/usr/bin/env node
import { build } from "vite";
// @ts-ignore
import fs from "fs";
// @ts-ignore
import process from "process";
import manifest from "../extension/manifest.json" with { type: "json" };
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react";

process.chdir("extension");

await build({
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
  mode: "development",
  build: {
    outDir: "../dist/extension",
    minify: false,
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
  build: {
    outDir: "../dist/extension",
    emptyOutDir: false,
    minify: false,
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

await build({
  build: {
    outDir: "../dist/extension",
    emptyOutDir: false,
    minify: false,
    rollupOptions: {
      input: {
        extensionHelper: "extensionHelper.ts",
      },
      output: {
        entryFileNames: "[name].js",
      },
    },
  },
});

fs.copyFileSync("manifest.json", "../dist/extension/manifest.json");

process.chdir("../doc");

await build({
  base: "./",
  build: {
    outDir: "../dist/doc",
    emptyOutDir: true,
    minify: false,
    modulePreload: false,
    assetsDir: ".",
    rollupOptions: {
      input: {
        doc: "index.html",
        test: "test/index.html",
      },
    },
  },
});

fs.writeFileSync(
  "../dist/doc/update.json",
  JSON.stringify(
    {
      version: manifest.version,
    },
    null,
    2
  )
);
