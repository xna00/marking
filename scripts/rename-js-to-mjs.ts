#!/usr/bin/env node
// @ts-nocheck
import fs from "fs";
import path from "path";

// 目标目录
const targetDir = path.join(__dirname, "dist/extension");

// 递归遍历目录并处理所有.js文件
function processDirectory(directory) {
  // 读取目录内容
  const files = fs.readdirSync(directory);

  files.forEach((file) => {
    const filePath = path.join(directory, file);
    const stats = fs.statSync(filePath);

    if (stats.isDirectory()) {
      // 递归处理子目录
      processDirectory(filePath);
    } else if (stats.isFile() && path.extname(file) === ".js") {
      // 处理.js文件
      renameAndUpdateImports(filePath);
    }
  });
}

// 将.js文件重命名为.ts并更新导入语句
function renameAndUpdateImports(filePath) {
  // 读取文件内容
  let content = fs.readFileSync(filePath, "utf8");

  // 更新ES模块导入语句中的.js扩展名（包括所有导入形式）
  content = content.replace(
    /import\s+(.*?)\s+from\s+['"]([^'"]+)\.js['"]/g,
    "import $1 from '$2.ts'"
  );
  content = content.replace(/import\s+['"]([^'"]+)\.js['"]/g, "import '$1.ts'");

  // 更新CommonJS require语句中的.js扩展名
  content = content.replace(
    /require\(['"]([^'"]+)\.js['"]\)/g,
    "require('$1.ts')"
  );

  // 写入更新后的内容
  fs.writeFileSync(filePath, content, "utf8");

  // 重命名文件
  const newFilePath = filePath.replace(/\.js$/, ".ts");
  fs.renameSync(filePath, newFilePath);

  console.log(`Renamed and updated: ${filePath} -> ${newFilePath}`);
}

// 开始处理
console.log(`Processing directory: ${targetDir}`);
processDirectory(targetDir);
console.log(
  "All .js files have been successfully renamed to .ts files and imports updated!"
);
