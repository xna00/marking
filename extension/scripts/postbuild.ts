#!/usr/bin/env node
/// <reference types="node" />

// 构建后处理：manifest.json 不参与 vite 打包，需要单独拷进产物；
// popup.html 的标题要带版本号，vite 没法改源文件里的字面量

import fs from "node:fs";
import manifest from "../manifest.json" with { type: "json" };

fs.copyFileSync("manifest.json", "../dist/extension/manifest.json");

const popupHtml = fs
  .readFileSync("../dist/extension/popup.html", "utf-8")
  .replace("<title>改卷仙人</title>", `<title>改卷仙人 v${manifest.version}</title>`);
fs.writeFileSync("../dist/extension/popup.html", popupHtml);
