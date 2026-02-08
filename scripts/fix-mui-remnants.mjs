#!/usr/bin/env node
/**
 * FULLSTÄNDIG MUI REMNANT REMOVER - tar bort ALLA MUI-rester
 * 
 * Fixar:
 * - sx={{ ... }} → className="..."
 * - component="..." props → native HTML elements
 * - elevation props → Tailwind shadow classes
 * - MUI theme references → Tailwind/design tokens
 * - Box props (display, flex, gap, etc) → className
 * - Typography props → native HTML
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDir = path.join(__dirname, '../src');

console.log('🔍 FULLSTÄNDIG MUI REMNANT SCAN & FIX\n');

let totalFiles = 0;
let totalFixes = 0;

// Patterns att hitta och fixa
const fixes = [
  // sx props med display/flex
  {
    pattern: /sx=\{\{\s*display:\s*['"]flex['"]\s*,\s*alignItems:\s*['"]([^'"]+)['"]\s*,\s*gap:\s*(\d+)\s*\}\}/g,
    replacement: 'className="flex items-$1 gap-$2"',
    name: 'sx flex props'
  },
  {
    pattern: /sx=\{\{\s*display:\s*['"]flex['"]\s*,\s*gap:\s*(\d+)\s*\}\}/g,
    replacement: 'className="flex gap-$1"',
    name: 'sx flex gap'
  },
  // Box component props - simple removal
  {
    pattern: /<Box component=["']([^"']+)["']/g,
    replacement: '<$1',
    name: 'Box component prop'
  },
  // Just convert Box to div for now
  {
    pattern: /<Box\s+(?![^>]*component=)/g,
    replacement: '<div ',
    name: 'Box to div'
  },
  {
    pattern: /<\/Box>/g,
    replacement: '</div>',
    name: 'Box closing tags'
  },
  // Typography component props
  {
    pattern: /<Typography component=["']([^"']+)["']/g,
    replacement: '<$1',
    name: 'Typography component prop'
  },
  // elevation props
  {
    pattern: /elevation=\{0\}/g,
    replacement: 'className="shadow-none"',
    name: 'elevation 0'
  },
  {
    pattern: /elevation=\{1\}/g,
    replacement: 'className="shadow-sm"',
    name: 'elevation 1'
  },
  {
    pattern: /elevation=\{2\}/g,
    replacement: 'className="shadow-md"',
    name: 'elevation 2'
  },
  {
    pattern: /elevation=\{3\}/g,
    replacement: 'className="shadow-lg"',
    name: 'elevation 3'
  },
  {
    pattern: /elevation=\{4\}/g,
    replacement: 'className="shadow-xl"',
    name: 'elevation 4'
  },
  // Common sx patterns
  {
    pattern: /sx=\{\{\s*p:\s*(\d+)\s*\}\}/g,
    replacement: 'className="p-$1"',
    name: 'sx padding'
  },
  {
    pattern: /sx=\{\{\s*m:\s*(\d+)\s*\}\}/g,
    replacement: 'className="m-$1"',
    name: 'sx margin'
  },
  {
    pattern: /sx=\{\{\s*mt:\s*(\d+)\s*\}\}/g,
    replacement: 'className="mt-$1"',
    name: 'sx margin-top'
  },
  {
    pattern: /sx=\{\{\s*mb:\s*(\d+)\s*\}\}/g,
    replacement: 'className="mb-$1"',
    name: 'sx margin-bottom'
  },
  // Remove complex sx props (needs manual review)
  {
    pattern: /sx=\{\{[^}]*\}\}/g,
    replacement: '/* TODO: Convert complex sx to Tailwind */',
    name: 'complex sx props (marked for manual review)'
  },
  // Box display props
  {
    pattern: /display=["']flex["']/g,
    replacement: 'className="flex"',
    name: 'display flex'
  },
  {
    pattern: /display=["']block["']/g,
    replacement: 'className="block"',
    name: 'display block'
  },
  // Common Box props
  {
    pattern: /gap=\{(\d+)\}/g,
    replacement: 'className="gap-$1"',
    name: 'gap prop'
  },
  {
    pattern: /alignItems=["']center["']/g,
    replacement: 'className="items-center"',
    name: 'alignItems center'
  },
  {
    pattern: /justifyContent=["']center["']/g,
    replacement: 'className="justify-center"',
    name: 'justifyContent center'
  },
];

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  let fileHasFixes = false;
  let fileFixes = [];

  fixes.forEach(fix => {
    const matches = content.match(fix.pattern);
    if (matches && matches.length > 0) {
      content = content.replace(fix.pattern, fix.replacement);
      fileHasFixes = true;
      fileFixes.push(`  ✓ ${matches.length}x ${fix.name}`);
      totalFixes += matches.length;
    }
  });

  if (fileHasFixes) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`\n📝 ${path.relative(srcDir, filePath)}`);
    fileFixes.forEach(fix => console.log(fix));
    totalFiles++;
  }
}

function walkDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      if (!file.startsWith('.') && file !== 'node_modules') {
        walkDirectory(filePath);
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      processFile(filePath);
    }
  });
}

walkDirectory(srcDir);

console.log(`\n✅ KLART!`);
console.log(`📁 Fixade filer: ${totalFiles}`);
console.log(`🔧 Totalt fixes: ${totalFixes}\n`);
console.log(`⚠️  OBS: Granska filer markerade med "TODO: Convert complex sx to Tailwind"`);
console.log(`    Dessa behöver manuell konvertering av komplexa sx props.\n`);
