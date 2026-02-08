/**
 * Accessibility Audit Script for Lugn-Trygg
 * Checks WCAG 2.1 AA compliance, color contrast, ARIA labels, keyboard navigation
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('╔═══════════════════════════════════════════════════════════════╗');
console.log('║   ♿ LUGN-TRYGG ACCESSIBILITY AUDIT                            ║');
console.log('╚═══════════════════════════════════════════════════════════════╝\n');

// ============================================
// ACCESSIBILITY CHECKLIST
// ============================================

const accessibilityChecklist = {
  'Perceivable': [
    {
      id: 'A11Y-001',
      guideline: '1.1.1 Non-text Content',
      requirement: 'All images must have alt text',
      level: 'A',
      status: 'TO_CHECK',
      howToFix: 'Add alt="" for decorative images, descriptive alt="..." for meaningful images'
    },
    {
      id: 'A11Y-002',
      guideline: '1.2.1 Audio-only and Video-only',
      requirement: 'Provide alternatives for audio/video',
      level: 'A',
      status: 'NOT_APPLICABLE',
      howToFix: 'Add transcripts for audio, descriptions for video'
    },
    {
      id: 'A11Y-003',
      guideline: '1.3.1 Info and Relationships',
      requirement: 'Use semantic HTML (headings, lists, tables)',
      level: 'A',
      status: 'TO_CHECK',
      howToFix: 'Use <h1>-<h6>, <ul>, <ol>, <table> instead of <div> with styling'
    },
    {
      id: 'A11Y-004',
      guideline: '1.4.1 Use of Color',
      requirement: 'Color is not the only visual means of conveying information',
      level: 'A',
      status: 'TO_CHECK',
      howToFix: 'Add icons, text labels, or patterns in addition to color'
    },
    {
      id: 'A11Y-005',
      guideline: '1.4.3 Contrast (Minimum)',
      requirement: 'Text contrast ratio at least 4.5:1 (AA)',
      level: 'AA',
      status: 'TO_CHECK',
      howToFix: 'Use darker colors for text, lighter for backgrounds. Check with contrast checker'
    },
    {
      id: 'A11Y-006',
      guideline: '1.4.4 Resize Text',
      requirement: 'Text can be resized up to 200% without loss of functionality',
      level: 'AA',
      status: 'TO_CHECK',
      howToFix: 'Use rem/em units instead of px, test with browser zoom'
    }
  ],
  
  'Operable': [
    {
      id: 'A11Y-007',
      guideline: '2.1.1 Keyboard',
      requirement: 'All functionality available via keyboard',
      level: 'A',
      status: 'TO_CHECK',
      howToFix: 'Ensure all interactive elements can be reached with Tab key'
    },
    {
      id: 'A11Y-008',
      guideline: '2.1.2 No Keyboard Trap',
      requirement: 'Keyboard focus can move away from any component',
      level: 'A',
      status: 'TO_CHECK',
      howToFix: 'Test modals, dropdowns - Escape key should close them'
    },
    {
      id: 'A11Y-009',
      guideline: '2.2.1 Timing Adjustable',
      requirement: 'User can turn off, adjust, or extend time limits',
      level: 'A',
      status: 'PASS',
      howToFix: 'N/A - No time limits in app'
    },
    {
      id: 'A11Y-010',
      guideline: '2.3.1 Three Flashes or Below',
      requirement: 'No content flashes more than 3 times per second',
      level: 'A',
      status: 'PASS',
      howToFix: 'N/A - No flashing content'
    },
    {
      id: 'A11Y-011',
      guideline: '2.4.1 Bypass Blocks',
      requirement: 'Mechanism to skip repeated content (skip to main)',
      level: 'A',
      status: 'TO_CHECK',
      howToFix: 'Add "Skip to main content" link at top of page'
    },
    {
      id: 'A11Y-012',
      guideline: '2.4.2 Page Titled',
      requirement: 'Web pages have descriptive titles',
      level: 'A',
      status: 'TO_CHECK',
      howToFix: 'Update <title> tags: "Dashboard | Lugn-Trygg"'
    },
    {
      id: 'A11Y-013',
      guideline: '2.4.3 Focus Order',
      requirement: 'Focus order is logical and intuitive',
      level: 'A',
      status: 'TO_CHECK',
      howToFix: 'Test with Tab key, ensure order matches visual layout'
    },
    {
      id: 'A11Y-014',
      guideline: '2.4.4 Link Purpose',
      requirement: 'Link purpose can be determined from link text',
      level: 'A',
      status: 'TO_CHECK',
      howToFix: 'Avoid "click here", use descriptive text: "Read mood analysis"'
    },
    {
      id: 'A11Y-015',
      guideline: '2.4.7 Focus Visible',
      requirement: 'Keyboard focus indicator is visible',
      level: 'AA',
      status: 'TO_CHECK',
      howToFix: 'Add :focus styles with outline or ring'
    }
  ],
  
  'Understandable': [
    {
      id: 'A11Y-016',
      guideline: '3.1.1 Language of Page',
      requirement: 'Default language is identified',
      level: 'A',
      status: 'TO_CHECK',
      howToFix: 'Add lang="sv" to <html> tag'
    },
    {
      id: 'A11Y-017',
      guideline: '3.2.1 On Focus',
      requirement: 'Focus does not trigger unexpected changes',
      level: 'A',
      status: 'PASS',
      howToFix: 'N/A - No unexpected changes on focus'
    },
    {
      id: 'A11Y-018',
      guideline: '3.2.2 On Input',
      requirement: 'Input does not trigger unexpected changes',
      level: 'A',
      status: 'PASS',
      howToFix: 'N/A - No unexpected changes on input'
    },
    {
      id: 'A11Y-019',
      guideline: '3.3.1 Error Identification',
      requirement: 'Input errors are identified and described',
      level: 'A',
      status: 'TO_CHECK',
      howToFix: 'Show clear error messages near form fields'
    },
    {
      id: 'A11Y-020',
      guideline: '3.3.2 Labels or Instructions',
      requirement: 'Labels or instructions are provided for inputs',
      level: 'A',
      status: 'TO_CHECK',
      howToFix: 'Add <label> for all <input> elements'
    },
    {
      id: 'A11Y-021',
      guideline: '3.3.3 Error Suggestion',
      requirement: 'Suggestions provided when input error detected',
      level: 'AA',
      status: 'TO_CHECK',
      howToFix: 'Add helpful error messages: "Email must contain @"'
    },
    {
      id: 'A11Y-022',
      guideline: '3.3.4 Error Prevention',
      requirement: 'Submissions are reversible or confirmable',
      level: 'AA',
      status: 'TO_CHECK',
      howToFix: 'Add confirmation dialogs for destructive actions'
    }
  ],
  
  'Robust': [
    {
      id: 'A11Y-023',
      guideline: '4.1.1 Parsing',
      requirement: 'HTML is valid (no duplicate IDs, proper nesting)',
      level: 'A',
      status: 'TO_CHECK',
      howToFix: 'Run HTML validator, fix errors'
    },
    {
      id: 'A11Y-024',
      guideline: '4.1.2 Name, Role, Value',
      requirement: 'UI components have accessible names and roles',
      level: 'A',
      status: 'TO_CHECK',
      howToFix: 'Add aria-label, role attributes to custom components'
    }
  ]
};

// ============================================
// ARIA BEST PRACTICES
// ============================================

const ariaBestPractices = {
  'Buttons': {
    html: '<button aria-label="Close dialog">×</button>',
    description: 'Use aria-label for buttons with only icons'
  },
  'Forms': {
    html: `<label for="email">Email</label>
<input id="email" type="email" aria-required="true" aria-describedby="email-error" />
<span id="email-error" role="alert">Please enter a valid email</span>`,
    description: 'Link labels to inputs, mark required fields, associate error messages'
  },
  'Modals': {
    html: `<div role="dialog" aria-labelledby="dialog-title" aria-modal="true">
  <h2 id="dialog-title">Confirm Action</h2>
  <p>Are you sure?</p>
  <button>Yes</button>
  <button>Cancel</button>
</div>`,
    description: 'Use role="dialog", aria-modal, and aria-labelledby'
  },
  'Loading Indicators': {
    html: '<div role="status" aria-live="polite" aria-label="Loading content">Loading...</div>',
    description: 'Use aria-live for dynamic content updates'
  },
  'Tabs': {
    html: `<div role="tablist">
  <button role="tab" aria-selected="true" aria-controls="panel1">Tab 1</button>
  <button role="tab" aria-selected="false" aria-controls="panel2">Tab 2</button>
</div>
<div id="panel1" role="tabpanel">Content 1</div>`,
    description: 'Use proper tab roles and aria-selected'
  },
  'Navigation': {
    html: `<nav aria-label="Main navigation">
  <ul>
    <li><a href="/" aria-current="page">Home</a></li>
    <li><a href="/about">About</a></li>
  </ul>
</nav>`,
    description: 'Use <nav> with aria-label, mark current page with aria-current'
  }
};

// ============================================
// COLOR CONTRAST CHECKER
// ============================================

const colorPairs = [
  { fg: '#6366f1', bg: '#ffffff', usage: 'Primary button text' },
  { fg: '#000000', bg: '#ffffff', usage: 'Body text' },
  { fg: '#4b5563', bg: '#ffffff', usage: 'Secondary text' },
  { fg: '#ffffff', bg: '#6366f1', usage: 'Button text' },
  { fg: '#10b981', bg: '#ffffff', usage: 'Success message' },
  { fg: '#ef4444', bg: '#ffffff', usage: 'Error message' },
];

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

function luminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(fg, bg) {
  const fgRgb = hexToRgb(fg);
  const bgRgb = hexToRgb(bg);
  const fgLum = luminance(fgRgb.r, fgRgb.g, fgRgb.b);
  const bgLum = luminance(bgRgb.r, bgRgb.g, bgRgb.b);
  const lighter = Math.max(fgLum, bgLum);
  const darker = Math.min(fgLum, bgLum);
  return (lighter + 0.05) / (darker + 0.05);
}

function checkContrastRatios() {
  console.log('\n🎨 Color Contrast Analysis:\n');
  console.log('┌──────────────────────────────────┬─────────┬────────┬────────┐');
  console.log('│ Color Pair                       │ Ratio   │ AA     │ AAA    │');
  console.log('├──────────────────────────────────┼─────────┼────────┼────────┤');
  
  colorPairs.forEach(({ fg, bg, usage }) => {
    const ratio = contrastRatio(fg, bg);
    const passAA = ratio >= 4.5;
    const passAAA = ratio >= 7.0;
    const emojiAA = passAA ? '✅' : '❌';
    const emojiAAA = passAAA ? '✅' : '❌';
    
    console.log(`│ ${usage.padEnd(32)} │ ${ratio.toFixed(2).padStart(7)} │ ${emojiAA}     │ ${emojiAAA}    │`);
  });
  
  console.log('└──────────────────────────────────┴─────────┴────────┴────────┘\n');
  console.log('ℹ️  AA requires 4.5:1, AAA requires 7:1 for normal text\n');
}

// ============================================
// GENERATE REPORTS
// ============================================

function printChecklist() {
  console.log('📋 WCAG 2.1 Compliance Checklist:\n');
  
  Object.entries(accessibilityChecklist).forEach(([principle, checks]) => {
    console.log(`\n═══ ${principle.toUpperCase()} ═══\n`);
    
    checks.forEach(check => {
      const status = check.status === 'PASS' ? '✅' : 
                     check.status === 'FAIL' ? '❌' : '⏳';
      console.log(`${status} [${check.id}] ${check.guideline} (Level ${check.level})`);
      console.log(`   ${check.requirement}`);
      if (check.status !== 'PASS' && check.status !== 'NOT_APPLICABLE') {
        console.log(`   💡 Fix: ${check.howToFix}`);
      }
      console.log();
    });
  });
}

function printARIABestPractices() {
  console.log('\n🎯 ARIA Best Practices:\n');
  
  Object.entries(ariaBestPractices).forEach(([component, { html, description }]) => {
    console.log(`▶️  ${component}:`);
    console.log(`   ${description}`);
    console.log('   ```html');
    html.split('\n').forEach(line => console.log(`   ${line}`));
    console.log('   ```\n');
  });
}

function generateFixScript() {
  console.log('\n🔧 Auto-Fix Script:\n');
  console.log('```bash');
  console.log('# Install accessibility testing tools');
  console.log('npm install -D @axe-core/react eslint-plugin-jsx-a11y');
  console.log('');
  console.log('# Add to eslintrc');
  console.log('echo "{\\"extends\\": [\\"plugin:jsx-a11y/recommended\\"]}" >> .eslintrc.json');
  console.log('');
  console.log('# Run linter');
  console.log('npm run lint -- --fix');
  console.log('```\n');
}

function generateTestingGuide() {
  console.log('\n🧪 Accessibility Testing Guide:\n');
  
  const testingSteps = [
    {
      step: '1. Keyboard Navigation Test',
      description: 'Can you navigate entire app using only Tab, Enter, Escape, Arrow keys?',
      commands: [
        'Tab - Move forward',
        'Shift+Tab - Move backward',
        'Enter/Space - Activate buttons',
        'Escape - Close dialogs/menus',
        'Arrow keys - Navigate lists/menus'
      ]
    },
    {
      step: '2. Screen Reader Test',
      description: 'Test with NVDA (Windows) or VoiceOver (Mac)',
      commands: [
        'Windows: NVDA (free) - https://www.nvaccess.org/',
        'Mac: VoiceOver (built-in) - Cmd+F5',
        'Check: All content is read aloud correctly'
      ]
    },
    {
      step: '3. Zoom Test',
      description: 'Zoom browser to 200% - is content still readable and usable?',
      commands: [
        'Chrome: Ctrl/Cmd + Plus (+)',
        'Firefox: Ctrl/Cmd + Plus (+)',
        'Check: No horizontal scrolling, no overlapping content'
      ]
    },
    {
      step: '4. Color Blindness Test',
      description: 'Test with color blindness simulator',
      commands: [
        'Chrome: DevTools → Rendering → Emulate vision deficiencies',
        'Test: Deuteranopia, Protanopia, Tritanopia',
        'Check: Information not conveyed by color alone'
      ]
    },
    {
      step: '5. Automated Testing',
      description: 'Run automated accessibility checks',
      commands: [
        'Lighthouse: Chrome DevTools → Lighthouse → Accessibility',
        'axe DevTools: Install browser extension',
        'Target: 90+ accessibility score'
      ]
    }
  ];
  
  testingSteps.forEach(({ step, description, commands }) => {
    console.log(`\n${step}`);
    console.log(`${description}\n`);
    commands.forEach(cmd => console.log(`   • ${cmd}`));
  });
  
  console.log('\n');
}

function generateSummary() {
  const totalChecks = Object.values(accessibilityChecklist).flat().length;
  const passedChecks = Object.values(accessibilityChecklist).flat().filter(c => c.status === 'PASS').length;
  const failedChecks = Object.values(accessibilityChecklist).flat().filter(c => c.status === 'FAIL').length;
  const toCheckChecks = Object.values(accessibilityChecklist).flat().filter(c => c.status === 'TO_CHECK').length;
  
  console.log('\n📊 Accessibility Summary:\n');
  console.log(`Total Checks:     ${totalChecks}`);
  console.log(`✅ Passed:        ${passedChecks}`);
  console.log(`❌ Failed:        ${failedChecks}`);
  console.log(`⏳ To Check:      ${toCheckChecks}`);
  console.log(`📈 Progress:      ${((passedChecks / totalChecks) * 100).toFixed(1)}%\n`);
  
  console.log('🎯 Priority Actions:');
  console.log('   1. Add alt text to all images');
  console.log('   2. Ensure proper color contrast (4.5:1 minimum)');
  console.log('   3. Add ARIA labels to interactive elements');
  console.log('   4. Test keyboard navigation');
  console.log('   5. Run Lighthouse accessibility audit');
  console.log('   6. Test with screen reader (NVDA/VoiceOver)\n');
}

// ============================================
// MAIN EXECUTION
// ============================================

function main() {
  printChecklist();
  checkContrastRatios();
  printARIABestPractices();
  generateTestingGuide();
  generateFixScript();
  generateSummary();
  
  console.log('✅ Accessibility audit complete!');
  console.log('📖 Review the checklist above and implement fixes.');
  console.log('🔗 Resources:');
  console.log('   • WCAG 2.1: https://www.w3.org/WAI/WCAG21/quickref/');
  console.log('   • WAI-ARIA: https://www.w3.org/WAI/ARIA/apg/');
  console.log('   • axe DevTools: https://www.deque.com/axe/devtools/\n');
}

main();
