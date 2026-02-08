const fs = require('fs');
const path = require('path');

// Function to get all source files
function getAllSourceFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.resolve(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...getAllSourceFiles(fullPath));
    } else if (item.endsWith('.ts') || item.endsWith('.tsx') || item.endsWith('.js') || item.endsWith('.jsx')) {
      files.push(fullPath);
    }
  }
  return files;
}

// Function to extract imports from a file
function extractImports(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const staticImportRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
  const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  const imports = [];
  let match;
  while ((match = staticImportRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  while ((match = dynamicImportRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  return imports;
}

// Function to normalize import path
function normalizeImportPath(importPath, fileDir) {
  if (importPath.startsWith('@/')) {
    return path.resolve('src', importPath.slice(2));
  } else if (importPath.startsWith('./') || importPath.startsWith('../')) {
    return path.resolve(fileDir, importPath);
  } else {
    // External import, skip
    return null;
  }
}

// Function to resolve to .ts/.tsx/.js/.jsx
function resolveToSourceFile(normalizedPath) {
  const extensions = ['.tsx', '.ts', '.jsx', '.js'];
  for (const ext of extensions) {
    const filePath = normalizedPath + ext;
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return filePath;
    }
  }
  // Check for index files
  for (const ext of extensions) {
    const indexPath = path.join(normalizedPath, 'index' + ext);
    if (fs.existsSync(indexPath) && fs.statSync(indexPath).isFile()) {
      return indexPath;
    }
  }
  return null;
}

// Main function
function findUnusedFiles() {
  const srcDir = 'src';
  const allFiles = getAllSourceFiles(srcDir);
  const importedFiles = new Set();

  for (const file of allFiles) {
    const fileDir = path.dirname(file);
    const imports = extractImports(file);
    for (const imp of imports) {
      const normalized = normalizeImportPath(imp, fileDir);
      if (normalized) {
        const resolved = resolveToSourceFile(normalized);
        if (resolved) {
          importedFiles.add(resolved);
        }
      }
    }
  }

  // Entry points that are always used
  const entryPoints = [
    'src/main.tsx',
    'src/App.tsx',
    'src/firebase-config.ts',
    'src/setupTests.ts',
    'src/vite-env.d.ts',
    'src/global.d.ts',
    'src/types.d.ts'
  ];

  for (const entry of entryPoints) {
    if (allFiles.includes(path.resolve(entry))) {
      importedFiles.add(path.resolve(entry));
    }
  }

  // Find unused files
  const unusedFiles = allFiles.filter(file => !importedFiles.has(file));

  console.log('Unused files:');
  unusedFiles.forEach(file => console.log(file));
}

findUnusedFiles();