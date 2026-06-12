import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, "..", "dist");

const REPLACEMENTS: [RegExp, string][] = [
  [/import\("undici-types"\)\.(\w+)/g, "$1"],
  [/import type \{ OutgoingHttpHeaders \} from "node:http";?\n?/g, ""],
  [/import type \{ IncomingMessage, ServerResponse \} from "node:http";?\n?/g, ""],
  [/import type \{ Server \} from "node:http";?\n?/g, ""],
  [/import \{ type StatementResultingChanges \} from 'node:sqlite';?\n?/g, ""],
  [/\bStatementResultingChanges\b/g, "any"],
  [/ResponseInit\["headers"\]/g, "any"],
  [/\bOutgoingHttpHeaders\b/g, "any"],
];

function stripDir(dir: string): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      stripDir(fullPath);
    } else if (entry.name.endsWith(".d.ts")) {
      let content = fs.readFileSync(fullPath, "utf-8");
      const original = content;
      for (const [pattern, replacement] of REPLACEMENTS) {
        content = content.replace(pattern, replacement);
      }
      if (content !== original) {
        fs.writeFileSync(fullPath, content, "utf-8");
        console.log("  stripped:", path.relative(distDir, fullPath));
      }
    }
  }
}

console.log("stripping types in", distDir);
stripDir(distDir);
console.log("done");
