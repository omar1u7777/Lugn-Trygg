/**
 * Auto-fix Material-UI Grid imports for v7
 * Use Unstable_Grid2 from @mui/material
 */

import fs from 'fs';
import { glob } from 'glob';

// Find all TypeScript/TSX files that have our Grid2 import
const files = glob.sync('src/**/*.{ts,tsx}');

let totalFixed = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let modified = false;

  // Replace Grid2 import with Unstable_Grid2
  if (content.includes('import Grid from \'@mui/material/Grid2\';')) {
    content = content.replace(
      'import Grid from \'@mui/material/Grid2\';',
      'import { Unstable_Grid2 as Grid } from \'@mui/material\';'
    );
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(file, content);
    console.log(`✅ Fixed: ${file}`);
    totalFixed++;
  }
});

console.log(`\n🎉 Total files fixed: ${totalFixed}`);
