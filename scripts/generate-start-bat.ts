#!/usr/bin/env node
// @ts-nocheck
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectDir = path.dirname(__dirname);
const ps1Path = path.join(projectDir, "start.ps1");
const batPath = path.join(projectDir, "dist/doc/改卷仙人.bat");

let ps1Content = fs.readFileSync(ps1Path, "utf-8");

// Remove BOM if present
if (ps1Content.charCodeAt(0) === 0xfeff) {
  ps1Content = ps1Content.slice(1);
}

const encodedCommand = Buffer.from(ps1Content, "utf16le").toString("base64");

const batContent = `@echo off
chcp 65001 >nul
powershell.exe -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encodedCommand}
`;

const batDir = path.dirname(batPath);
if (!fs.existsSync(batDir)) {
  fs.mkdirSync(batDir, { recursive: true });
}

fs.writeFileSync(batPath, batContent, "utf-8");
console.log("Generated dist/doc/改卷仙人.bat");
