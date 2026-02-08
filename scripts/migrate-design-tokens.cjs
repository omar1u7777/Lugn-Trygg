#!/usr/bin/env node
/**
 * Design Token Migration Script
 * Automatically replaces hardcoded values with design tokens
 * 
 * Usage: node scripts/migrate-design-tokens.js
 */

const fs = require('fs');
const path = require('path');

// Color mappings
const COLOR_REPLACEMENTS = {
  '#1abc9c': 'colors.primary.main',
  '#48c9b0': 'colors.primary.light',
  '#16a085': 'colors.primary.dark',
  '#3498db': 'colors.secondary.main',
  '#5dade2': 'colors.secondary.light',
  '#2980b9': 'colors.secondary.dark',
  '#9b59b6': 'colors.tertiary.main',
  '#bb8fce': 'colors.tertiary.light',
  '#8e44ad': 'colors.tertiary.dark',
  '#27ae60': 'colors.success.main',
  '#58d68d': 'colors.success.light',
  '#e74c3c': 'colors.error.main',
  '#ec7063': 'colors.error.light',
  '#c0392b': 'colors.error.dark',
  '#f39c12': 'colors.warning.main',
  '#f8c471': 'colors.warning.light',
  '#2c3e50': 'colors.text.primary',
  '#7f8c8d': 'colors.text.secondary',
  '#bdc3c7': 'colors.text.disabled',
  '#ffffff': 'colors.text.inverse',
  '#f8f9fa': 'colors.background.default',
  
  // Mood colors
  '#10b981': 'colors.mood.ecstatic',
  '#059669': 'colors.mood.happy',
  '#0d9488': 'colors.mood.content',
  '#6b7280': 'colors.mood.neutral',
  '#3b82f6': 'colors.mood.anxious',
  '#f59e0b': 'colors.mood.sad',
  '#ef4444': 'colors.mood.depressed',
  
  // Specific colors
  '#4caf50': 'colors.mood.glad',
  '#8bc34a': 'colors.mood.lycklig',
  '#cddc39': 'colors.mood.nöjd',
  '#ffeb3b': 'colors.mood.tacksam',
  '#ffc107': 'colors.mood.positiv',
  '#ff9800': 'colors.mood.ledsen',
  '#f44336': 'colors.mood.arg',
  '#e91e63': 'colors.mood.stressad',
  '#9c27b0': 'colors.mood.deppig',
  '#673ab7': 'colors.mood.frustrerad',
  '#3f51b5': 'colors.mood.irriterad',
  '#2196f3': 'colors.mood.orolig',
  
  // Overlay colors
  'rgba(255,255,255,0.1)': 'colors.overlay.light',
  'rgba(255,255,255,0.2)': 'colors.overlay.medium',
  'rgba(255,255,255,0.3)': 'colors.overlay.heavy',
  'rgba(255, 255, 255, 0.1)': 'colors.overlay.light',
  'rgba(255, 255, 255, 0.2)': 'colors.overlay.medium',
  'rgba(255, 255, 255, 0.3)': 'colors.overlay.heavy',
  'rgba(255,255,255,0.8)': 'colors.overlay.medium',
  'rgba(255,255,255,0.9)': 'colors.overlay.medium',
  
  // Gradients
  "linear-gradient(135deg, #f8fafc 0%, #ffffff 50%, #f1f5f9 100%)": 'colors.background.gradient',
};

// Spacing mappings (MUI uses 8px base)
const SPACING_REPLACEMENTS = {
  'p: 4': 'p: spacing.xl',
  'p: 3': 'p: spacing.lg',
  'p: 2': 'p: spacing.md',
  'p: 1': 'p: spacing.sm',
  'mb: 6': 'mb: spacing.xxl',
  'mb: 4': 'mb: spacing.xl',
  'mb: 3': 'mb: spacing.lg',
  'mb: 2': 'mb: spacing.md',
  'mb: 1': 'mb: spacing.sm',
  'mt: 6': 'mt: spacing.xxl',
  'mt: 4': 'mt: spacing.xl',
  'mt: 3': 'mt: spacing.lg',
  'mt: 2': 'mt: spacing.md',
  'mt: 1': 'mt: spacing.sm',
  'gap: 3': 'gap: spacing.lg',
  'gap: 2': 'gap: spacing.md',
  'gap: 1': 'gap: spacing.sm',
  'px: 6': 'px: spacing.xxl',
  'py: 2': 'py: spacing.md',
  'borderRadius: 16': 'borderRadius: borderRadius.card',
  'borderRadius: 12': 'borderRadius: borderRadius.xl',
  'borderRadius: 10': 'borderRadius: borderRadius.button',
  'borderRadius: 8': 'borderRadius: borderRadius.chip',
  'borderRadius: 4': 'borderRadius: borderRadius.xl',
  'borderRadius: 3': 'borderRadius: borderRadius.lg',
  'borderRadius: 2': 'borderRadius: borderRadius.md',
};

// Shadow replacements
const SHADOW_REPLACEMENTS = {
  "boxShadow: '0px 4px 12px rgba(0,0,0,0.08)'": 'boxShadow: shadows.card',
  "boxShadow: '0px 8px 24px rgba(0,0,0,0.12)'": 'boxShadow: shadows.cardHover',
  'boxShadow: 2': 'boxShadow: shadows.md',
  "boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'": 'boxShadow: shadows.xl',
};

function migrateFile(filePath) {
  console.log(`\n📄 Processing: ${filePath}`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  let changes = 0;
  
  // Check if tokens are already imported
  const hasTokenImport = content.includes('from \'../theme/tokens\'') || content.includes('from \'@/theme/tokens\'');
  
  // Replace colors
  Object.entries(COLOR_REPLACEMENTS).forEach(([oldColor, newToken]) => {
    const regex = new RegExp(oldColor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const matches = content.match(regex);
    if (matches) {
      content = content.replace(regex, newToken);
      changes += matches.length;
      console.log(`  ✓ Replaced ${matches.length}x: ${oldColor} → ${newToken}`);
    }
  });
  
  // Replace spacing
  Object.entries(SPACING_REPLACEMENTS).forEach(([oldSpacing, newToken]) => {
    const regex = new RegExp(oldSpacing.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const matches = content.match(regex);
    if (matches) {
      content = content.replace(regex, newToken);
      changes += matches.length;
      console.log(`  ✓ Replaced ${matches.length}x: ${oldSpacing} → ${newToken}`);
    }
  });
  
  // Replace shadows
  Object.entries(SHADOW_REPLACEMENTS).forEach(([oldShadow, newToken]) => {
    const regex = new RegExp(oldShadow.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const matches = content.match(regex);
    if (matches) {
      content = content.replace(regex, newToken);
      changes += matches.length;
      console.log(`  ✓ Replaced ${matches.length}x: ${oldShadow.substring(0, 30)}... → ${newToken}`);
    }
  });
  
  // Add import if changes were made and import doesn't exist
  if (changes > 0 && !hasTokenImport) {
    const importMatch = content.match(/import.*from\s+['"]react['"]/);
    if (importMatch) {
      const insertPosition = content.indexOf(importMatch[0]) + importMatch[0].length;
      const tokensImport = `\nimport { colors, spacing, shadows, borderRadius } from '../theme/tokens';`;
      content = content.slice(0, insertPosition) + tokensImport + content.slice(insertPosition);
      console.log(`  ✓ Added tokens import`);
    }
  }
  
  if (changes > 0) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  ✅ Migrated ${changes} occurrences`);
  } else {
    console.log(`  ⏭️  No changes needed`);
  }
  
  return changes;
}

function findTsxFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      if (!file.startsWith('.') && file !== 'node_modules') {
        findTsxFiles(filePath, fileList);
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Main execution
console.log('🚀 Design Token Migration Script');
console.log('=================================\n');

const componentsDir = path.join(__dirname, '../src/components');
const files = findTsxFiles(componentsDir);

console.log(`Found ${files.length} TypeScript/React files\n`);

let totalChanges = 0;
files.forEach(file => {
  totalChanges += migrateFile(file);
});

console.log('\n=================================');
console.log(`✅ Migration complete!`);
console.log(`📊 Total changes: ${totalChanges}`);
console.log(`📁 Files processed: ${files.length}`);
console.log('\n💡 Next steps:');
console.log('  1. Run: npm run type-check');
console.log('  2. Test components visually');
console.log('  3. Commit changes');
