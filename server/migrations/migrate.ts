#!/usr/bin/env node

import { DatabaseSync } from "node:sqlite";
import { copyFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dbDir = join(import.meta.dirname, "..", "data");
const dbPath = join(dbDir, "marking.db");

const sqlFile = process.argv[2];
if (!sqlFile) { console.error("Usage: ./migrate.ts <sql-file>"); process.exit(1); }

const sqlPath = join(import.meta.dirname, sqlFile);
const sql = readFileSync(sqlPath, "utf-8");

// Backup with timestamp
const pad2 = (n: number) => String(n).padStart(2, "0");
const d = new Date();
const ts = `${d.getFullYear()}${pad2(d.getMonth()+1)}${pad2(d.getDate())}_${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
const backupPath = join(dbDir, `marking.${ts}_bak.db`);
copyFileSync(dbPath, backupPath);
console.log(`Backup: ${backupPath}`);

// Execute entire SQL at once
const db = new DatabaseSync(dbPath);
db.exec(sql);
db.close();
console.log("Migration applied");
