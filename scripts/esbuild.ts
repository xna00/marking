#!/usr/bin/env node

import * as esbuild from "esbuild";

// await esbuild.build({
//   entryPoints: ["extension/lib.ts"],
//   bundle: true,
//   outfile: "dist/extension/lib.js",
//   format: "esm",
// });

await esbuild.build({
  entryPoints: ["extension/background.ts", "extension/popup/index.ts"],
  bundle: true,
  outdir: "dist/extension",
  format: "esm",
  splitting: true,
});

await esbuild.build({
  entryPoints: ["extension/content.ts"],
  bundle: true,
  outdir: "dist/extension",
  format: "esm",
});

await esbuild.build({
  entryPoints: ["extension/extensionHelper.ts"],
  bundle: true,
  outdir: "dist/extension",
  format: "esm",
});

await esbuild.build({
  entryPoints: ["doc/**/*.ts"],
  outdir: "dist/doc",
  format: "esm",
});

// await esbuild.build({
//   entryPoints: ["doc/test/test.ts"],
//   outdir: "dist/doc/test",
//   format: "esm",
// });
