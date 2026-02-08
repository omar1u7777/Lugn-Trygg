import { logger } from './logger';
/**
 * Accessibility Audit Utility for WCAG 2.1 AA Compliance
 * Automated testing and validation of accessibility features
 */

interface AuditResult {
  passed: boolean;
  violations: string[];
  warnings: string[];
  score: number;
  details: Record<string, any>;
}

interface ColorContrastResult {
  ratio: number;
  isCompliant: boolean;
  requiredRatio: number;
  textSize: 'normal' | 'large';
}

interface FocusManagementResult {
  hasVisibleFocus: boolean;
  focusOrder: boolean;
  keyboardNavigation: boolean;
  skipLinks: boolean;
}

interface AriaComplianceResult {
  hasLabels: boolean;
  hasDescriptions: boolean;
  validRoles: boolean;
  liveRegions: boolean;
}

interface ScreenReaderResult {
  hasAltText: boolean;
  semanticStructure: boolean;
  headingHierarchy: boolean;
  landmarkRegions: boolean;
}

export class AccessibilityAuditor {
  private static instance: AccessibilityAuditor;

  static getInstance(): AccessibilityAuditor {
    if (!AccessibilityAuditor.instance) {
      AccessibilityAuditor.instance = new AccessibilityAuditor();
    }
    return AccessibilityAuditor.instance;
  }

  /**
   * Run complete accessibility audit
   */
  async runFullAudit(): Promise<AuditResult> {
    const results = await Promise.all([
      this.auditColorContrast(),
      this.auditFocusManagement(),
      this.auditAriaCompliance(),
      this.auditScreenReaderSupport(),
      this.auditKeyboardNavigation(),
      this.auditSemanticStructure(),
    ]);

    const violations: string[] = [];
    const warnings: string[] = [];
    let totalScore = 0;

    results.forEach(result => {
      violations.push(...result.violations);
      warnings.push(...result.warnings);
      totalScore += result.score;
    });

    const averageScore = totalScore / results.length;
    const passed = violations.length === 0 && averageScore >= 85;

    return {
      passed,
      violations,
      warnings,
      score: averageScore,
      details: {
        colorContrast: results[0],
        focusManagement: results[1],
        ariaCompliance: results[2],
        screenReader: results[3],
        keyboardNavigation: results[4],
        semanticStructure: results[5],
      },
    };
  }

  /**
   * Audit color contrast ratios
   */
  async auditColorContrast(): Promise<AuditResult & { details: ColorContrastResult[] }> {
    const violations: string[] = [];
    const warnings: string[] = [];
    const contrastResults: ColorContrastResult[] = [];

    try {
      // Get all text elements
      const textElements = document.querySelectorAll('p, span, h1, h2, h3, h4, h5, h6, div, button, a');

      for (const element of textElements) {
        const computedStyle = window.getComputedStyle(element);
        const fontSize = parseFloat(computedStyle.fontSize);
        const fontWeight = parseFloat(computedStyle.fontWeight);
        const backgroundColor = computedStyle.backgroundColor;
        const color = computedStyle.color;

        // Determine if text is large
        const isLargeText = fontSize >= 18 || (fontSize >= 14 && fontWeight >= 700);

        // Calculate contrast ratio (simplified)
        const contrastRatio = this.calculateContrastRatio(color, backgroundColor);
        const requiredRatio = isLargeText ? 3.0 : 4.5;

        const result: ColorContrastResult = {
          ratio: contrastRatio,
          isCompliant: contrastRatio >= requiredRatio,
          requiredRatio,
          textSize: isLargeText ? 'large' : 'normal',
        };

        contrastResults.push(result);

        if (!result.isCompliant) {
          violations.push(
            `Insufficient color contrast (${contrastRatio.toFixed(2)}:1) on element: ${element.textContent?.substring(0, 50)}...`
          );
        }
      }

      const score = violations.length === 0 ? 100 : Math.max(0, 100 - violations.length * 10);

      return {
        passed: violations.length === 0,
        violations,
        warnings,
        score,
        details: contrastResults,
      };
    } catch (error) {
      violations.push(`Color contrast audit failed: ${error}`);
      return {
        passed: false,
        violations,
        warnings,
        score: 0,
        details: [],
      };
    }
  }

  /**
   * Audit focus management
   */
  async auditFocusManagement(): Promise<AuditResult & { details: FocusManagementResult }> {
    const violations: string[] = [];
    const warnings: string[] = [];

    try {
      // Check for visible focus indicators
      const focusableElements = document.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      let hasVisibleFocus = false;
      for (const element of focusableElements) {
        const computedStyle = window.getComputedStyle(element as HTMLElement, ':focus-visible');
        if (computedStyle.outline !== 'none' || computedStyle.boxShadow.includes('rgb')) {
          hasVisibleFocus = true;
          break;
        }
      }

      if (!hasVisibleFocus) {
        violations.push('No visible focus indicators found on interactive elements');
      }

      // Check focus order
      const focusOrder = this.checkFocusOrder();
      if (!focusOrder) {
        warnings.push('Focus order may not follow logical tab sequence');
      }

      // Check for skip links
      const skipLinks = document.querySelectorAll('a[href^="#"]').length > 0;
      if (!skipLinks) {
        warnings.push('No skip links found for keyboard navigation');
      }

      // Check keyboard navigation
      const keyboardNavigation = await this.testKeyboardNavigation();

      const details: FocusManagementResult = {
        hasVisibleFocus,
        focusOrder,
        keyboardNavigation,
        skipLinks,
      };

      const score = [hasVisibleFocus, focusOrder, keyboardNavigation, skipLinks].filter(Boolean).length * 25;

      return {
        passed: violations.length === 0,
        violations,
        warnings,
        score,
        details,
      };
    } catch (error) {
      violations.push(`Focus management audit failed: ${error}`);
      return {
        passed: false,
        violations,
        warnings,
        score: 0,
        details: {
          hasVisibleFocus: false,
          focusOrder: false,
          keyboardNavigation: false,
          skipLinks: false,
        },
      };
    }
  }

  /**
   * Audit ARIA compliance
   */
  async auditAriaCompliance(): Promise<AuditResult & { details: AriaComplianceResult }> {
    const violations: string[] = [];
    const warnings: string[] = [];

    try {
      // Check for missing labels
      const interactiveElements = document.querySelectorAll('button, input, select, textarea');
      let hasLabels = true;

      for (const element of interactiveElements) {
        const hasAriaLabel = element.hasAttribute('aria-label');
        const hasAriaLabelledBy = element.hasAttribute('aria-labelledby');
        const hasLabel = document.querySelector(`label[for="${element.id}"]`) !== null;

        if (!hasAriaLabel && !hasAriaLabelledBy && !hasLabel && element.id) {
          violations.push(`Interactive element missing label: ${element.tagName}[id="${element.id}"]`);
          hasLabels = false;
        }
      }

      // Check for valid ARIA roles
      const elementsWithRole = document.querySelectorAll('[role]');
      let validRoles = true;

      const validAriaRoles = [
        'alert', 'alertdialog', 'application', 'article', 'banner', 'button', 'cell', 'checkbox',
        'columnheader', 'combobox', 'complementary', 'contentinfo', 'definition', 'dialog',
        'directory', 'document', 'feed', 'figure', 'form', 'grid', 'gridcell', 'group', 'heading',
        'img', 'link', 'list', 'listbox', 'listitem', 'log', 'main', 'marquee', 'math', 'meter',
        'menu', 'menubar', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'navigation',
        'none', 'note', 'option', 'presentation', 'progressbar', 'radio', 'radiogroup',
        'region', 'row', 'rowgroup', 'rowheader', 'scrollbar', 'search', 'searchbox',
        'separator', 'slider', 'spinbutton', 'status', 'switch', 'tab', 'table', 'tablist',
        'tabpanel', 'term', 'textbox', 'timer', 'toolbar', 'tooltip', 'tree', 'treegrid',
        'treeitem'
      ];

      for (const element of elementsWithRole) {
        const role = element.getAttribute('role');
        if (role && !validAriaRoles.includes(role)) {
          violations.push(`Invalid ARIA role: ${role}`);
          validRoles = false;
        }
      }

      // Check for live regions
      const liveRegions = document.querySelectorAll('[aria-live]').length > 0;

      // Check for descriptions
      const elementsWithDescribedBy = document.querySelectorAll('[aria-describedby]');
      const hasDescriptions = elementsWithDescribedBy.length > 0;

      const details: AriaComplianceResult = {
        hasLabels,
        hasDescriptions,
        validRoles,
        liveRegions,
      };

      const score = [hasLabels, hasDescriptions, validRoles, liveRegions].filter(Boolean).length * 25;

      return {
        passed: violations.length === 0,
        violations,
        warnings,
        score,
        details,
      };
    } catch (error) {
      violations.push(`ARIA compliance audit failed: ${error}`);
      return {
        passed: false,
        violations,
        warnings,
        score: 0,
        details: {
          hasLabels: false,
          hasDescriptions: false,
          validRoles: false,
          liveRegions: false,
        },
      };
    }
  }

  /**
   * Audit screen reader support
   */
  async auditScreenReaderSupport(): Promise<AuditResult & { details: ScreenReaderResult }> {
    const violations: string[] = [];
    const warnings: string[] = [];

    try {
      // Check for missing alt text
      const images = document.querySelectorAll('img');
      let hasAltText = true;

      for (const img of images) {
        if (!img.hasAttribute('alt') || img.getAttribute('alt') === '') {
          violations.push(`Image missing alt text: ${img.src}`);
          hasAltText = false;
        }
      }

      // Check semantic structure
      const hasMain = document.querySelector('main') !== null;
      const hasHeader = document.querySelector('header') !== null;
      const hasNav = document.querySelector('nav') !== null;
      const semanticStructure = hasMain && hasHeader && hasNav;

      if (!semanticStructure) {
        warnings.push('Missing semantic HTML structure (main, header, nav)');
      }

      // Check heading hierarchy
      const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      let headingHierarchy = true;
      let lastLevel = 0;

      for (const heading of headings) {
        const level = parseInt(heading.tagName.charAt(1));
        if (level - lastLevel > 1) {
          warnings.push('Heading hierarchy may be broken (skipping levels)');
          headingHierarchy = false;
          break;
        }
        lastLevel = level;
      }

      // Check for landmark regions
      const landmarks = document.querySelectorAll('[role="main"], [role="navigation"], [role="banner"], [role="contentinfo"], main, nav, header, footer');
      const landmarkRegions = landmarks.length >= 3;

      if (!landmarkRegions) {
        warnings.push('Insufficient ARIA landmark regions for navigation');
      }

      const details: ScreenReaderResult = {
        hasAltText,
        semanticStructure,
        headingHierarchy,
        landmarkRegions,
      };

      const score = [hasAltText, semanticStructure, headingHierarchy, landmarkRegions].filter(Boolean).length * 25;

      return {
        passed: violations.length === 0,
        violations,
        warnings,
        score,
        details,
      };
    } catch (error) {
      violations.push(`Screen reader audit failed: ${error}`);
      return {
        passed: false,
        violations,
        warnings,
        score: 0,
        details: {
          hasAltText: false,
          semanticStructure: false,
          headingHierarchy: false,
          landmarkRegions: false,
        },
      };
    }
  }

  /**
   * Test keyboard navigation
   */
  async testKeyboardNavigation(): Promise<boolean> {
    try {
      // This would require more complex testing in a real implementation
      // For now, check if there are any tabindex="-1" that might trap focus
      const negativeTabIndex = document.querySelectorAll('[tabindex="-1"]');
      const focusableWithNegativeTabIndex = Array.from(negativeTabIndex).filter(element => {
        const tagName = element.tagName.toLowerCase();
        return ['button', 'input', 'select', 'textarea', 'a'].includes(tagName) ||
               element.hasAttribute('href') ||
               element.hasAttribute('onclick');
      });

      return focusableWithNegativeTabIndex.length === 0;
    } catch (error) {
      logger.error('Keyboard navigation test failed:', error);
      return false;
    }
  }

  /**
   * Audit keyboard navigation
   */
  async auditKeyboardNavigation(): Promise<AuditResult> {
    const violations: string[] = [];
    const warnings: string[] = [];

    try {
      const hasProperKeyboardNav = await this.testKeyboardNavigation();
      
      if (!hasProperKeyboardNav) {
        violations.push('Some focusable elements have negative tabindex');
      }

      const focusableElements = document.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );

      if (focusableElements.length === 0) {
        warnings.push('No focusable elements found on page');
      }

      const score = violations.length === 0 ? 100 : 50;

      return {
        passed: violations.length === 0,
        violations,
        warnings,
        score,
        details: {
          hasProperKeyboardNav,
          focusableElementsCount: focusableElements.length,
        },
      };
    } catch (error) {
      violations.push(`Keyboard navigation audit failed: ${error}`);
      return {
        passed: false,
        violations,
        warnings,
        score: 0,
        details: {},
      };
    }
  }

  /**
   * Check semantic structure
   */
  async auditSemanticStructure(): Promise<AuditResult> {
    const violations: string[] = [];
    const warnings: string[] = [];

    try {
      // Check for proper form structure
      const forms = document.querySelectorAll('form');
      for (const form of forms) {
        const inputs = form.querySelectorAll('input, select, textarea');
        const labels = form.querySelectorAll('label');

        if (inputs.length > 0 && labels.length === 0) {
          warnings.push('Form found without proper labels');
        }
      }

      // Check for table structure
      const tables = document.querySelectorAll('table');
      for (const table of tables) {
        const hasHeaders = table.querySelectorAll('th').length > 0;
        if (!hasHeaders) {
          warnings.push('Table found without proper headers');
        }
      }

      // Check for list structure
      const lists = document.querySelectorAll('ul, ol');
      for (const list of lists) {
        const listItems = list.querySelectorAll('li');
        if (listItems.length === 0) {
          warnings.push('List found without list items');
        }
      }

      const score = Math.max(0, 100 - warnings.length * 10);

      return {
        passed: violations.length === 0,
        violations,
        warnings,
        score,
        details: {},
      };
    } catch (error) {
      violations.push(`Semantic structure audit failed: ${error}`);
      return {
        passed: false,
        violations,
        warnings,
        score: 0,
        details: {},
      };
    }
  }

  /**
   * Calculate contrast ratio between two colors
   */
  private calculateContrastRatio(color1: string, color2: string): number {
    // Simplified contrast calculation
    // In production, use a proper color parsing library
    try {
      // Convert colors to RGB values (simplified)
      const getLuminance = (color: string): number => {
        // This is a simplified version - real implementation would parse actual colors
        if (color.includes('#')) {
          // Simple hex to luminance conversion
          return 0.5; // Placeholder
        }
        return 0.5; // Placeholder
      };

      const lum1 = getLuminance(color1);
      const lum2 = getLuminance(color2);

      const brightest = Math.max(lum1, lum2);
      const darkest = Math.min(lum1, lum2);

      return (brightest + 0.05) / (darkest + 0.05);
    } catch {
      return 1; // Default ratio
    }
  }

  /**
   * Check focus order
   */
  private checkFocusOrder(): boolean {
    try {
      // Simplified focus order check
      // In a real implementation, this would simulate tab navigation
      const focusableElements = document.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      // Check if elements are in a reasonable order
      let lastTop = -1;
      for (const element of focusableElements) {
        const rect = (element as HTMLElement).getBoundingClientRect();
        if (rect.top < lastTop - 50) { // Allow some tolerance
          return false; // Focus order might be broken
        }
        lastTop = rect.top;
      }

      return true;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const accessibilityAuditor = AccessibilityAuditor.getInstance();

// Export types
export type { AuditResult, ColorContrastResult, FocusManagementResult, AriaComplianceResult, ScreenReaderResult };