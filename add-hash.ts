// @ts-nocheck
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 要处理的目录
const targetDir = path.join(__dirname, 'dist/doc');

// 生成文件内容的hash值
function generateHash(content) {
  const hash = crypto.createHash('md5');
  hash.update(content);
  return hash.digest('hex').substring(0, 8);
}

// 处理文件，添加hash
function processFile(filePath) {
  const ext = path.extname(filePath);
  const fileName = path.basename(filePath, ext);
  const dir = path.dirname(filePath);
  
  // 读取文件内容
  const content = fs.readFileSync(filePath);
  
  // 生成hash
  const hash = generateHash(content);
  
  // 新文件名
  const newFileName = `${fileName}.${hash}${ext}`;
  const newFilePath = path.join(dir, newFileName);
  
  // 重命名文件
  fs.renameSync(filePath, newFilePath);
  
  return { oldName: path.basename(filePath), newName: newFileName, newFilePath };
}

// 递归处理目录，根据文件类型分阶段处理
function processFilesByType(dirPath, targetExts) {
  const files = fs.readdirSync(dirPath);
  const renamedFiles = [];
  
  files.forEach(file => {
    const filePath = path.join(dirPath, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // 递归处理子目录
      renamedFiles.push(...processFilesByType(filePath, targetExts));
    } else {
      // 只处理指定类型的文件
      const ext = path.extname(file).toLowerCase();
      if (targetExts.includes(ext)) {
        // 检查文件是否已经添加过hash（格式：name.hash.ext）
        const baseName = path.basename(file, ext);
        if (!/\.[0-9a-f]{8}$/.test(baseName)) {
          const result = processFile(filePath);
          renamedFiles.push(result);
        }
      }
    }
  });
  
  return renamedFiles;
}

// 更新文件中的引用
function updateReferences(filePath, renamedFiles) {
  const content = fs.readFileSync(filePath, 'utf8');
  let updatedContent = content;
  
  renamedFiles.forEach(({ oldName, newName }) => {
    // 更新script和link标签中的引用
    const regex1 = new RegExp(`(${oldName})(?=\"|\')`, 'g');
    updatedContent = updatedContent.replace(regex1, newName);
    
    // 更新JavaScript导入语句
    const regex2 = new RegExp(`from\s+['\"]([^\'"]*${oldName})['\"]`, 'g');
    updatedContent = updatedContent.replace(regex2, (match, importPath) => {
      return match.replace(oldName, newName);
    });
    
    // 更新CommonJS require语句
    const regex3 = new RegExp(`require\(['\"]([^\'"]*${oldName})['\"]\)`, 'g');
    updatedContent = updatedContent.replace(regex3, (match, requirePath) => {
      return match.replace(oldName, newName);
    });
  });
  
  if (updatedContent !== content) {
    fs.writeFileSync(filePath, updatedContent);
    return true;
  }
  
  return false;
}

// 更新所有相关文件中的引用
function updateAllReferences(renamedFiles, fileTypeFilter = null) {
  // 收集所有需要更新的文件路径
  const filesToUpdate = [];
  
  // 添加HTML文件
  const htmlFiles = ['index.html'];
  htmlFiles.forEach(htmlFile => {
    const htmlPath = path.join(targetDir, htmlFile);
    if (fs.existsSync(htmlPath)) {
      filesToUpdate.push(htmlPath);
    }
  });
  
  // 添加符合条件的JavaScript文件
  if (fileTypeFilter === null || fileTypeFilter === '.js') {
    const jsFiles = getAllFilesWithExtension(targetDir, '.js');
    jsFiles.forEach(jsFile => {
      if (fs.existsSync(jsFile)) {
        filesToUpdate.push(jsFile);
      }
    });
  }
  
  // 更新所有收集到的文件
  filesToUpdate.forEach(filePath => {
    const fileName = path.basename(filePath);
    console.log(`更新 ${fileName} 中的引用...`);
    updateReferences(filePath, renamedFiles);
  });
}

// 递归获取目录下所有特定扩展名的文件
function getAllFilesWithExtension(dirPath, ext) {
  const files = fs.readdirSync(dirPath);
  const result = [];
  
  files.forEach(file => {
    const filePath = path.join(dirPath, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      result.push(...getAllFilesWithExtension(filePath, ext));
    } else {
      if (path.extname(file).toLowerCase() === ext) {
        result.push(filePath);
      }
    }
  });
  
  return result;
}

// 清理旧文件
function cleanOldFiles(renamedFiles) {
  const oldNames = renamedFiles.map(file => file.oldName);
  
  // 遍历目录，删除未添加hash的旧文件
  function deleteOldFiles(dirPath) {
    const files = fs.readdirSync(dirPath);
    
    files.forEach(file => {
      const filePath = path.join(dirPath, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        deleteOldFiles(filePath);
      } else {
        if (oldNames.includes(file)) {
          console.log(`删除旧文件: ${file}`);
          fs.unlinkSync(filePath);
        }
      }
    });
  }
  
  deleteOldFiles(targetDir);
}

// 主函数 - 分阶段处理文件，考虑依赖关系
function main() {
  console.log('开始为文件添加hash...');
  
  // 第一阶段：处理非JavaScript文件（如zip、图片等），它们不引用其他文件
  console.log('\n1. 处理非JavaScript文件（zip, 图片等）...');
  const nonJsFiles = processFilesByType(targetDir, ['.css', '.png', '.jpg', '.jpeg', '.svg', '.gif', '.zip']);
  
  if (nonJsFiles.length > 0) {
    console.log('非JavaScript文件重命名完成:');
    nonJsFiles.forEach(({ oldName, newName }) => {
      console.log(`  ${oldName} -> ${newName}`);
    });
    
    // 更新HTML和JavaScript文件中的引用
    updateAllReferences(nonJsFiles);
  }
  
  // 第二阶段：处理JavaScript文件，因为它们的内容可能已经因为引用更新而改变
  console.log('\n2. 处理JavaScript文件...');
  const jsFiles = processFilesByType(targetDir, ['.js']);
  
  if (jsFiles.length > 0) {
    console.log('JavaScript文件重命名完成:');
    jsFiles.forEach(({ oldName, newName }) => {
      console.log(`  ${oldName} -> ${newName}`);
    });
    
    // 更新HTML文件和JavaScript文件中的引用
    updateAllReferences(jsFiles);
  }
  
  // 清理所有旧文件
  console.log('\n3. 清理旧文件...');
  cleanOldFiles([...nonJsFiles, ...jsFiles]);
  
  console.log('\n所有操作完成!');
}

// 执行主函数
main();