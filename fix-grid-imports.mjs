/**
 * Auto-fix Material-UI Grid imports for v7
 * Converts Grid imports to use Grid2 for compatibility
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

// Find all TypeScript/TSX files
const files = glob.sync('src/**/*.{ts,tsx}');

let totalFixed = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let modified = false;

  // Check if file uses Grid from MUI
  if (content.includes('from \'@mui/material\'') && /[,{\s]Grid[,}\s]/.test(content)) {
    
    // Pattern 1: Grid in the import list - handle multi-line imports
    const pattern1 = /import\s+{([^}]+)}\s+from\s+'@mui\/material';/gs;
    content = content.replace(pattern1, (match, imports) => {
      if (imports.includes('Grid')) {
        // Remove Grid from the imports
        const importLines = imports.split('\n').map(line => {
          return line.split(',').map(i => i.trim()).filter(i => i && i !== 'Grid').join(', ');
        }).filter(line => line).join(',\n  ');
        
        modified = true;
        return `import {\n  ${importLines}\n} from '@mui/material';\nimport Grid from '@mui/material/Grid2';`;
      }
      return match;
    });
  }

  if (modified) {
    // Remove 'item' prop from Grid components
    content = content.replace(/<Grid\s+item\s+/g, '<Grid ');
    
    fs.writeFileSync(file, content);
    console.log(`✅ Fixed: ${file}`);
    totalFixed++;
  }
});

console.log(`\n🎉 Total files fixed: ${totalFixed}`);
