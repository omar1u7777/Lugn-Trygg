/**
 * Script to automatically replace MUI imports with Tailwind equivalents
 * Run with: node scripts/replace-mui-imports.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// MUI to Tailwind component mapping
const componentMapping = {
  // MUI Material -> Tailwind
  'Box': 'Box',
  'Container': 'Container',
  'Grid': 'Grid',
  'Stack': 'Stack',
  'Card': 'Card',
  'CardContent': 'CardContent',
  'CardHeader': 'CardHeader',
  'Button': 'Button',
  'TextField': 'Input',
  'Typography': 'Typography', // Will need custom component
  'Alert': 'Alert',
  'Chip': 'Chip',
  'Badge': 'Badge',
  'Avatar': 'Avatar',
  'CircularProgress': 'Spinner',
  'LinearProgress': 'Progress',
  'Divider': 'Divider',
  'Dialog': 'Dialog',
  'Snackbar': 'Snackbar',
  'Skeleton': 'Skeleton',
};

// Icons to replace
const iconMapping = {
  '@mui/icons-material': '@heroicons/react/24/outline',
};

function replaceImports(content) {
  let modified = content;

  // Replace @mui/material imports
  const muiMaterialRegex = /import\s+{([^}]+)}\s+from\s+['"]@mui\/material['"]/g;
  modified = modified.replace(muiMaterialRegex, (match, imports) => {
    const importList = imports
      .split(',')
      .map(imp => imp.trim())
      .filter(imp => componentMapping[imp])
      .join(', ');

    if (importList) {
      return `import { ${importList} } from '../ui/tailwind'`;
    }
    return '';
  });

  // Replace @mui/icons-material imports with heroicons
  const muiIconsRegex = /import\s+{([^}]+)}\s+from\s+['"]@mui\/icons-material['"]/g;
  modified = modified.replace(muiIconsRegex, (match, imports) => {
    // For now, comment them out to fix build errors
    return `// TODO: Replace icons with @heroicons/react\n// ${match}`;
  });

  // Replace @emotion imports (remove)
  modified = modified.replace(/import.*from\s+['"]@emotion\/[^'"]+['"]/g, '');

  return modified;
}

function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');

    // Check if file contains MUI imports
    if (content.includes('@mui/material') || content.includes('@mui/icons-material') || content.includes('@emotion')) {
      console.log(`Processing: ${filePath}`);
      const modified = replaceImports(content);

      if (modified !== content) {
        fs.writeFileSync(filePath, modified, 'utf8');
        console.log(`✓ Updated: ${filePath}`);
        return true;
      }
    }
  } catch (err) {
    console.error(`Error processing ${filePath}:`, err.message);
  }
  return false;
}

function processDirectory(dirPath) {
  let count = 0;
  const items = fs.readdirSync(dirPath);

  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      // Skip node_modules, dist, build
      if (!['node_modules', 'dist', 'build', '.git'].includes(item)) {
        count += processDirectory(fullPath);
      }
    } else if (stat.isFile() && (item.endsWith('.tsx') || item.endsWith('.ts'))) {
      if (processFile(fullPath)) {
        count++;
      }
    }
  }

  return count;
}

// Start processing
const srcPath = path.resolve(__dirname, '../src');
console.log('Starting MUI to Tailwind migration...\n');
console.log(`Scanning: ${srcPath}\n`);

const filesModified = processDirectory(srcPath);

console.log(`\n✅ Migration complete!`);
console.log(`📝 Files modified: ${filesModified}`);
console.log(`\n⚠️  Next steps:`);
console.log(`1. Review Typography components (need custom implementation)`);
console.log(`2. Replace @mui/icons-material with @heroicons/react`);
console.log(`3. Update component props (sx -> className, etc.)`);
console.log(`4. Test all components`);
