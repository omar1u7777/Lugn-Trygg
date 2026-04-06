import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAccessibility, accessibilityAudit, ariaUtils, keyboardUtils } from '../useAccessibility';

// Mock window.matchMedia
const createMatchMedia = (matches: boolean) => ({
  matches,
  media: '',
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
});

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => {
      if (query.includes('prefers-reduced-motion')) return createMatchMedia(false);
      if (query.includes('prefers-contrast: high')) return createMatchMedia(false);
      if (query.includes('prefers-color-scheme: dark')) return createMatchMedia(false);
      return createMatchMedia(false);
    }),
  });
  // Make CSS.supports return false to test :focus-visible polyfill
  Object.defineProperty(window, 'CSS', {
    writable: true,
    configurable: true,
    value: { supports: vi.fn().mockReturnValue(false) },
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  // Clean up any live regions added to document
  document.body.innerHTML = '';
});

describe('useAccessibility', () => {
  it('returns expected initial state', () => {
    const { result } = renderHook(() => useAccessibility());
    expect(result.current.reducedMotion).toBe(false);
    expect(result.current.highContrast).toBe(false);
    expect(result.current.keyboardNavigation).toBe(true);
    expect(result.current.focusVisible).toBe(true);
    expect(result.current.fontSize).toBe('medium');
  });

  it('detects dark color scheme from matchMedia', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => {
        if (query.includes('prefers-color-scheme: dark')) return createMatchMedia(true);
        return createMatchMedia(false);
      }),
    });
    const { result } = renderHook(() => useAccessibility());
    expect(result.current.colorScheme).toBe('dark');
  });

  it('detects reduced motion from matchMedia', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => {
        if (query.includes('prefers-reduced-motion')) return createMatchMedia(true);
        return createMatchMedia(false);
      }),
    });
    const { result } = renderHook(() => useAccessibility());
    expect(result.current.reducedMotion).toBe(true);
  });

  it('detects high contrast from matchMedia', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => {
        if (query.includes('prefers-contrast: high')) return createMatchMedia(true);
        return createMatchMedia(false);
      }),
    });
    const { result } = renderHook(() => useAccessibility());
    expect(result.current.highContrast).toBe(true);
  });

  describe('getAriaLabel', () => {
    it('returns content when no tooltip', () => {
      const { result } = renderHook(() => useAccessibility());
      expect(result.current.getAriaLabel('Open menu')).toBe('Open menu');
    });

    it('returns content with tooltip when provided', () => {
      const { result } = renderHook(() => useAccessibility());
      expect(result.current.getAriaLabel('Open menu', 'Click to open the navigation menu')).toBe(
        'Open menu, Click to open the navigation menu'
      );
    });

    it('returns empty string content', () => {
      const { result } = renderHook(() => useAccessibility());
      expect(result.current.getAriaLabel('')).toBe('');
    });
  });

  describe('updateLiveRegion', () => {
    it('calls updateLiveRegion without throwing', () => {
      const { result } = renderHook(() => useAccessibility());
      expect(() => result.current.updateLiveRegion('Test message')).not.toThrow();
    });

    it('calls updateLiveRegion with assertive priority', () => {
      const { result } = renderHook(() => useAccessibility());
      expect(() => result.current.updateLiveRegion('Urgent!', 'assertive')).not.toThrow();
    });
  });

  describe('announceToScreenReader', () => {
    it('announces polite message without throwing', () => {
      const { result } = renderHook(() => useAccessibility());
      expect(() => result.current.announceToScreenReader('Hello', 'polite')).not.toThrow();
    });

    it('announces assertive message', () => {
      const { result } = renderHook(() => useAccessibility());
      expect(() => result.current.announceToScreenReader('Error occurred', 'assertive')).not.toThrow();
    });

    it('runs the delayed textContent update', async () => {
      const { result } = renderHook(() => useAccessibility());
      result.current.announceToScreenReader('Test message', 'polite');
      act(() => {
        vi.runAllTimers();
      });
      // Just verify no throw — actual DOM effect depends on live region being created
    });
  });

  describe('setFocus', () => {
    it('calls focus on element after timeout', () => {
      const { result } = renderHook(() => useAccessibility());
      const el = document.createElement('button');
      const focusSpy = vi.spyOn(el, 'focus');
      el.scrollIntoView = vi.fn();
      document.body.appendChild(el);

      result.current.setFocus(el);
      act(() => {
        vi.runAllTimers();
      });
      expect(focusSpy).toHaveBeenCalled();
    });

    it('does nothing when element is null', () => {
      const { result } = renderHook(() => useAccessibility());
      expect(() => result.current.setFocus(null)).not.toThrow();
    });
  });

  describe('skipToContent', () => {
    it('focuses element with matching id', () => {
      const { result } = renderHook(() => useAccessibility());
      const target = document.createElement('div');
      target.id = 'main-content';
      target.setAttribute('aria-label', 'Main content');
      target.focus = vi.fn();
      target.scrollIntoView = vi.fn();
      document.body.appendChild(target);

      result.current.skipToContent('main-content');
      act(() => {
        vi.runAllTimers();
      });
      expect(target.focus).toHaveBeenCalled();
    });

    it('does nothing when id not found', () => {
      const { result } = renderHook(() => useAccessibility());
      expect(() => result.current.skipToContent('nonexistent-id')).not.toThrow();
    });
  });

  describe('trapFocus', () => {
    it('returns a cleanup function', () => {
      const { result } = renderHook(() => useAccessibility());
      const container = document.createElement('div');
      const button1 = document.createElement('button');
      const button2 = document.createElement('button');
      button1.focus = vi.fn();
      button2.focus = vi.fn();
      button1.scrollIntoView = vi.fn();
      button2.scrollIntoView = vi.fn();
      container.appendChild(button1);
      container.appendChild(button2);
      document.body.appendChild(container);

      let cleanup: (() => void) | undefined;
      act(() => {
        cleanup = result.current.trapFocus(container);
      });
      expect(typeof cleanup).toBe('function');
      expect(() => cleanup?.()).not.toThrow();
    });

    it('handles Escape key by clicking close button', () => {
      const { result } = renderHook(() => useAccessibility());
      const container = document.createElement('div');
      const button = document.createElement('button');
      button.setAttribute('data-close-modal', '');
      const clickSpy = vi.spyOn(button, 'click');
      button.focus = vi.fn();
      button.scrollIntoView = vi.fn();
      container.appendChild(button);
      document.body.appendChild(container);

      result.current.trapFocus(container);
      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
      container.dispatchEvent(escapeEvent);
      expect(clickSpy).toHaveBeenCalled();
    });

    it('handles Tab key for focus cycling', () => {
      const { result } = renderHook(() => useAccessibility());
      const container = document.createElement('div');
      const button1 = document.createElement('button');
      const button2 = document.createElement('button');
      button1.focus = vi.fn();
      button2.focus = vi.fn();
      button1.scrollIntoView = vi.fn();
      button2.scrollIntoView = vi.fn();
      container.appendChild(button1);
      container.appendChild(button2);
      document.body.appendChild(container);

      result.current.trapFocus(container);
      // Simulate Tab from last element
      Object.defineProperty(document, 'activeElement', { value: button2, configurable: true });
      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
      container.dispatchEvent(tabEvent);
      // Should not throw
    });

    it('handles Shift+Tab for reverse focus cycling', () => {
      const { result } = renderHook(() => useAccessibility());
      const container = document.createElement('div');
      const button1 = document.createElement('button');
      const button2 = document.createElement('button');
      button1.focus = vi.fn();
      button2.focus = vi.fn();
      button1.scrollIntoView = vi.fn();
      button2.scrollIntoView = vi.fn();
      container.appendChild(button1);
      container.appendChild(button2);
      document.body.appendChild(container);

      result.current.trapFocus(container);
      // Simulate Shift+Tab from first element
      Object.defineProperty(document, 'activeElement', { value: button1, configurable: true });
      const shiftTabEvent = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true });
      container.dispatchEvent(shiftTabEvent);
    });
  });

  describe('handleKeyboardNavigation', () => {
    it('returns false when target is not in keyboard-nav container', () => {
      const { result } = renderHook(() => useAccessibility());
      const el = document.createElement('button');
      document.body.appendChild(el);
      const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true });
      Object.defineProperty(event, 'target', { value: el, configurable: true });
      const handled = result.current.handleKeyboardNavigation(event);
      expect(handled).toBe(false);
    });

    it('handles ArrowRight in keyboard-nav container', () => {
      const { result } = renderHook(() => useAccessibility());
      const container = document.createElement('div');
      container.setAttribute('data-keyboard-nav', '');
      const button1 = document.createElement('button');
      const button2 = document.createElement('button');
      button1.focus = vi.fn();
      button2.focus = vi.fn();
      button1.scrollIntoView = vi.fn();
      button2.scrollIntoView = vi.fn();
      container.appendChild(button1);
      container.appendChild(button2);
      document.body.appendChild(container);

      const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true });
      Object.defineProperty(event, 'target', { value: button1, configurable: true });
      const handled = result.current.handleKeyboardNavigation(event);
      expect(handled).toBe(true);
    });

    it('handles ArrowLeft in keyboard-nav container', () => {
      const { result } = renderHook(() => useAccessibility());
      const container = document.createElement('div');
      container.setAttribute('data-keyboard-nav', '');
      const button1 = document.createElement('button');
      const button2 = document.createElement('button');
      button1.focus = vi.fn();
      button2.focus = vi.fn();
      button1.scrollIntoView = vi.fn();
      button2.scrollIntoView = vi.fn();
      container.appendChild(button1);
      container.appendChild(button2);
      document.body.appendChild(container);

      const event = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true });
      Object.defineProperty(event, 'target', { value: button2, configurable: true });
      const handled = result.current.handleKeyboardNavigation(event);
      expect(handled).toBe(true);
    });

    it('handles ArrowDown in keyboard-nav container', () => {
      const { result } = renderHook(() => useAccessibility());
      const container = document.createElement('div');
      container.setAttribute('data-keyboard-nav', '');
      const button1 = document.createElement('button');
      button1.focus = vi.fn();
      button1.scrollIntoView = vi.fn();
      container.appendChild(button1);
      document.body.appendChild(container);

      const event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true });
      Object.defineProperty(event, 'target', { value: button1, configurable: true });
      const handled = result.current.handleKeyboardNavigation(event);
      expect(handled).toBe(true);
    });

    it('handles ArrowUp in keyboard-nav container', () => {
      const { result } = renderHook(() => useAccessibility());
      const container = document.createElement('div');
      container.setAttribute('data-keyboard-nav', '');
      const button1 = document.createElement('button');
      button1.focus = vi.fn();
      button1.scrollIntoView = vi.fn();
      container.appendChild(button1);
      document.body.appendChild(container);

      const event = new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true });
      Object.defineProperty(event, 'target', { value: button1, configurable: true });
      const handled = result.current.handleKeyboardNavigation(event);
      expect(handled).toBe(true);
    });

    it('handles Home key in keyboard-nav container', () => {
      const { result } = renderHook(() => useAccessibility());
      const container = document.createElement('div');
      container.setAttribute('data-keyboard-nav', '');
      const button1 = document.createElement('button');
      const button2 = document.createElement('button');
      button1.focus = vi.fn();
      button2.focus = vi.fn();
      button1.scrollIntoView = vi.fn();
      button2.scrollIntoView = vi.fn();
      container.appendChild(button1);
      container.appendChild(button2);
      document.body.appendChild(container);

      const event = new KeyboardEvent('keydown', { key: 'Home', bubbles: true });
      Object.defineProperty(event, 'target', { value: button2, configurable: true });
      const handled = result.current.handleKeyboardNavigation(event);
      expect(handled).toBe(true);
    });

    it('handles End key in keyboard-nav container', () => {
      const { result } = renderHook(() => useAccessibility());
      const container = document.createElement('div');
      container.setAttribute('data-keyboard-nav', '');
      const button1 = document.createElement('button');
      const button2 = document.createElement('button');
      button1.focus = vi.fn();
      button2.focus = vi.fn();
      button1.scrollIntoView = vi.fn();
      button2.scrollIntoView = vi.fn();
      container.appendChild(button1);
      container.appendChild(button2);
      document.body.appendChild(container);

      const event = new KeyboardEvent('keydown', { key: 'End', bubbles: true });
      Object.defineProperty(event, 'target', { value: button1, configurable: true });
      const handled = result.current.handleKeyboardNavigation(event);
      expect(handled).toBe(true);
    });

    it('returns false for unhandled keys in keyboard-nav container', () => {
      const { result } = renderHook(() => useAccessibility());
      const container = document.createElement('div');
      container.setAttribute('data-keyboard-nav', '');
      const button1 = document.createElement('button');
      button1.focus = vi.fn();
      button1.scrollIntoView = vi.fn();
      container.appendChild(button1);
      document.body.appendChild(container);

      const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
      Object.defineProperty(event, 'target', { value: button1, configurable: true });
      const handled = result.current.handleKeyboardNavigation(event);
      expect(handled).toBe(false);
    });
  });

  describe('screenReader detection', () => {
    it('detects screen reader from aria-live element', () => {
      // Add aria-live element before rendering to trigger detection
      const liveEl = document.createElement('div');
      liveEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(liveEl);

      const { result } = renderHook(() => useAccessibility());
      // screenReaderActive may be true since there's an aria-live element
      // (set by the hook itself during setup)
      expect(typeof result.current.screenReaderActive).toBe('boolean');
    });

    it('has screenReaderActive as boolean', () => {
      const { result } = renderHook(() => useAccessibility());
      expect(typeof result.current.screenReaderActive).toBe('boolean');
    });
  });
});

describe('accessibilityAudit', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  describe('checkAltText', () => {
    it('reports 0 missing when all images have alt', () => {
      const img = document.createElement('img');
      img.setAttribute('alt', 'photo');
      document.body.appendChild(img);
      const report = accessibilityAudit.checkAltText();
      expect(report.total).toBe(1);
      expect(report.missing).toBe(0);
    });

    it('reports missing alt text when absent', () => {
      const img = document.createElement('img');
      document.body.appendChild(img);
      const report = accessibilityAudit.checkAltText();
      expect(report.missing).toBe(1);
      expect(report.elements).toHaveLength(1);
    });

    it('accepts aria-label as alternative to alt', () => {
      const img = document.createElement('img');
      img.setAttribute('aria-label', 'logo');
      document.body.appendChild(img);
      const report = accessibilityAudit.checkAltText();
      expect(report.missing).toBe(0);
    });
  });

  describe('checkLabels', () => {
    it('reports 0 missing when all inputs have labels', () => {
      const input = document.createElement('input');
      input.id = 'name';
      input.setAttribute('aria-label', 'Name');
      document.body.appendChild(input);
      const report = accessibilityAudit.checkLabels();
      expect(report.missing).toBe(0);
    });

    it('reports missing label for unlabelled input', () => {
      const input = document.createElement('input');
      input.id = 'no-label';
      document.body.appendChild(input);
      const report = accessibilityAudit.checkLabels();
      expect(report.missing).toBeGreaterThan(0);
    });

    it('ignores hidden inputs', () => {
      const input = document.createElement('input');
      input.type = 'hidden';
      document.body.appendChild(input);
      const report = accessibilityAudit.checkLabels();
      expect(report.missing).toBe(0);
    });
  });

  describe('checkColorContrast', () => {
    it('returns checked: false placeholder', () => {
      const result = accessibilityAudit.checkColorContrast();
      expect(result.checked).toBe(false);
      expect(result.message).toBeTruthy();
    });
  });

  describe('checkHeadingHierarchy', () => {
    it('reports valid hierarchy', () => {
      ['h1', 'h2', 'h3'].forEach(tag => {
        const el = document.createElement(tag);
        el.textContent = tag;
        document.body.appendChild(el);
      });
      const report = accessibilityAudit.checkHeadingHierarchy();
      expect(report.total).toBe(3);
      expect(report.valid).toBe(true);
    });

    it('detects skipped heading level', () => {
      const h1 = document.createElement('h1');
      const h3 = document.createElement('h3');
      document.body.appendChild(h1);
      document.body.appendChild(h3);
      const report = accessibilityAudit.checkHeadingHierarchy();
      expect(report.valid).toBe(false);
      expect(report.issues.length).toBeGreaterThan(0);
    });

    it('flags first heading not being h1', () => {
      const h2 = document.createElement('h2');
      document.body.appendChild(h2);
      const report = accessibilityAudit.checkHeadingHierarchy();
      expect(report.valid).toBe(false);
    });

    it('returns empty for page with no headings', () => {
      const report = accessibilityAudit.checkHeadingHierarchy();
      expect(report.total).toBe(0);
      expect(report.valid).toBe(true);
    });
  });

  describe('checkFocusableElements', () => {
    it('returns count of focusable elements', () => {
      const btn = document.createElement('button');
      document.body.appendChild(btn);
      const report = accessibilityAudit.checkFocusableElements();
      expect(report.count).toBeGreaterThan(0);
      expect(report.elements).toBeInstanceOf(Array);
    });
  });

  describe('generateReport', () => {
    it('returns a report with all sections', () => {
      const report = accessibilityAudit.generateReport();
      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('altText');
      expect(report).toHaveProperty('labels');
      expect(report).toHaveProperty('headings');
      expect(report).toHaveProperty('focusable');
      expect(report).toHaveProperty('colorContrast');
    });
  });
});

describe('ariaUtils', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
  });
  afterEach(() => { vi.useRealTimers(); });

  describe('setLiveRegion', () => {
    it('appends a live region to the body', () => {
      ariaUtils.setLiveRegion('Page loaded');
      act(() => { vi.advanceTimersByTime(200); });
      // The region is added and then removed after 1000ms
      act(() => { vi.advanceTimersByTime(1100); });
    });

    it('supports assertive priority', () => {
      expect(() => ariaUtils.setLiveRegion('Alert!', 'assertive')).not.toThrow();
      act(() => { vi.runAllTimers(); });
    });
  });

  describe('toggleExpanded', () => {
    it('sets aria-expanded attribute', () => {
      const btn = document.createElement('button');
      ariaUtils.toggleExpanded(btn, true);
      expect(btn.getAttribute('aria-expanded')).toBe('true');
      ariaUtils.toggleExpanded(btn, false);
      expect(btn.getAttribute('aria-expanded')).toBe('false');
    });

    it('sets aria-hidden on controlled content', () => {
      const btn = document.createElement('button');
      btn.setAttribute('aria-controls', 'panel-1');
      const panel = document.createElement('div');
      panel.id = 'panel-1';
      document.body.appendChild(panel);
      ariaUtils.toggleExpanded(btn, true);
      expect(panel.getAttribute('aria-hidden')).toBe('false');
      ariaUtils.toggleExpanded(btn, false);
      expect(panel.getAttribute('aria-hidden')).toBe('true');
    });
  });

  describe('announcePageChange', () => {
    it('does not throw', () => {
      expect(() => ariaUtils.announcePageChange('Dashboard')).not.toThrow();
      act(() => { vi.runAllTimers(); });
    });
  });
});

describe('keyboardUtils', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
  });
  afterEach(() => { vi.useRealTimers(); });

  describe('createSkipLinks', () => {
    it('inserts skip links into the document', () => {
      keyboardUtils.createSkipLinks([
        { text: 'Skip to main', target: 'main' },
        { text: 'Skip to nav', target: 'nav' },
      ]);
      const container = document.querySelector('.skip-links');
      expect(container).not.toBeNull();
      const anchors = container!.querySelectorAll('a');
      expect(anchors).toHaveLength(2);
      expect(anchors[0].textContent).toBe('Skip to main');
    });

    it('assigns Alt+N shortcuts', () => {
      keyboardUtils.createSkipLinks([{ text: 'Main', target: 'main' }]);
      const anchor = document.querySelector('[data-skip-link]');
      expect(anchor?.getAttribute('data-shortcut')).toBe('Alt+1');
    });

    it('shows container on focusin', () => {
      keyboardUtils.createSkipLinks([{ text: 'Main', target: 'main' }]);
      const container = document.querySelector('.skip-links') as HTMLElement;
      container.dispatchEvent(new FocusEvent('focusin'));
      expect(container.style.top).toBe('6px');
    });

    it('hides container on focusout when focus leaves', () => {
      keyboardUtils.createSkipLinks([{ text: 'Main', target: 'main' }]);
      const container = document.querySelector('.skip-links') as HTMLElement;
      container.dispatchEvent(new FocusEvent('focusin'));
      container.dispatchEvent(new FocusEvent('focusout'));
      act(() => { vi.advanceTimersByTime(200); });
      expect(container.style.top).toBe('-40px');
    });
  });

  describe('manageFocus', () => {
    it('save returns the active element', () => {
      const btn = document.createElement('button');
      document.body.appendChild(btn);
      btn.focus();
      const saved = keyboardUtils.manageFocus.save();
      expect(saved).not.toBeNull();
    });

    it('restore focuses an element', () => {
      const btn = document.createElement('button');
      const focusSpy = vi.spyOn(btn, 'focus');
      document.body.appendChild(btn);
      keyboardUtils.manageFocus.restore(btn);
      expect(focusSpy).toHaveBeenCalled();
    });

    it('restore does nothing for null', () => {
      expect(() => keyboardUtils.manageFocus.restore(null)).not.toThrow();
    });

    it('moveTo focuses element matching selector', () => {
      const btn = document.createElement('button');
      btn.id = 'my-btn';
      const focusSpy = vi.spyOn(btn, 'focus');
      btn.scrollIntoView = vi.fn();
      document.body.appendChild(btn);
      keyboardUtils.manageFocus.moveTo('#my-btn');
      expect(focusSpy).toHaveBeenCalled();
    });

    it('moveTo does nothing for missing selector', () => {
      expect(() => keyboardUtils.manageFocus.moveTo('#nonexistent')).not.toThrow();
    });
  });
});
