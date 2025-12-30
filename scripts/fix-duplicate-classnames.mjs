#!/usr/bin/env node
/**
 * Fix duplicate className attributes - merge them
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDir = path.join(__dirname, '../src');

console.log('🔍 Fixing duplicate className attributes...\n');

let totalFiles = 0;
let totalFixes = 0;

function mergeClassNames(content) {
  // Match tags with multiple className attributes
  const tagPattern = /<(\w+)([^>]*?)>/g;
  
  return content.replace(tagPattern, (fullMatch, tagName, attributes) => {
    // Find all className attributes
    const classNamePattern = /className=["']([^"']*)["']/g;
    const classNames = [];
    let match;
    
    while ((match = classNamePattern.exec(attributes)) !== null) {
      classNames.push(match[1]);
    }
    
    if (classNames.length > 1) {
      // Merge all classNames
      const mergedClasses = classNames.join(' ');
      // Remove all className attributes
      let newAttributes = attributes.replace(/className=["'][^"']*["']\s*/g, '');
      // Add merged className at the beginning
      newAttributes = `className="${mergedClasses}" ${newAttributes}`;
      totalFixes++;
      return `<${tagName}${newAttributes}>`;
    }
    
    return fullMatch;
  });
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  
  content = mergeClassNames(content);
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✓ ${path.relative(srcDir, filePath)}`);
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

console.log(`\n✅ Fixed ${totalFixes} duplicate className attributes in ${totalFiles} files\n`);
