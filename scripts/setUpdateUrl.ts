#!/usr/bin/env node

// @ts-ignore
import fs from "fs";
import manifest from "../extension/manifest.json" with { type: "json" };
const HOST = "https://marking.xna00.top";

fs.copyFileSync(
  "dist/doc/extension.zip",
  `dist/doc/extension_${manifest.version}.zip`
);

fs.writeFileSync(
  "dist/doc/update.json",
  JSON.stringify({
    version: manifest.version,
    extensionUrl: new URL(`extension_${manifest.version}.zip`, HOST).href,
  })
);
