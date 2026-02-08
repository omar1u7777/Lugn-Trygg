/**
 * Revert Grid imports back to normal Grid from @mui/material
 * MUI v7 uses Grid directly, no need for Grid2 or Unstable_Grid2
 */

import fs from 'fs';
import { glob } from 'glob';

const files = glob.sync('src/**/*.{ts,tsx}');

let totalFixed = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  const original = content;

  // Replace Unstable_Grid2 import back to regular Grid
  content = content.replace(
    /import { Unstable_Grid2 as Grid } from '@mui\/material';/g,
    ''
  );
  
  // Find the @mui/material import and add Grid to it
  const muiImportMatch = content.match(/import\s+{([^}]+)}\s+from\s+'@mui\/material';/);
  if (muiImportMatch && original.includes('Unstable_Grid2')) {
    const imports = muiImportMatch[1];
    if (!imports.includes('Grid')) {
      const newImports = imports.trim() + ',\n  Grid';
      content = content.replace(
        /import\s+{([^}]+)}\s+from\s+'@mui\/material';/,
        `import {\n  ${newImports}\n} from '@mui/material';`
      );
    }
  }
  
  // Clean up multiple consecutive newlines
  content = content.replace(/\n\n\n+/g, '\n\n');

  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log(`✅ Fixed: ${file}`);
    totalFixed++;
  }
});

console.log(`\n🎉 Total files fixed: ${totalFixed}`);
