/**
 * Remove 'item' prop from all Grid components
 */

import fs from 'fs';
import { glob } from 'glob';

const files = glob.sync('src/**/*.{ts,tsx}');

let totalFixed = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  const original = content;

  // Remove 'item' and 'item ' from Grid tags
  // Match various patterns like: <Grid item xs={...}>, <Grid item md={...}>, etc.
  content = content.replace(/<Grid\s+item\s+/g, '<Grid ');
  content = content.replace(/<Grid\s+item>/g, '<Grid>');
  
  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log(`✅ Removed 'item' prop from: ${file}`);
    totalFixed++;
  }
});

console.log(`\n🎉 Total files fixed: ${totalFixed}`);
