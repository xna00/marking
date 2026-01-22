#!/usr/bin/env node

import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["extension/lib.ts"],
  bundle: true,
  outfile: "dist/extension/lib.js",
  format: "esm",
});
