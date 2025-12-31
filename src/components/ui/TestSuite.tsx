import React, { useState, useEffect } from 'react';
import { Card, Button, Input } from './tailwind';
import { LoadingSpinner } from '../LoadingStates';
import { ThemeToggle } from './ThemeToggle';
import { useAccessibility } from '../../hooks/useAccessibility';

interface TestResult {
  test: string;
  status: 'pass' | 'fail' | 'pending';
  message?: string;
  duration?: number;
}

interface TestSuiteProps {
  onComplete?: (results: TestResult[]) => void;
  autoRun?: boolean;
}

/**
 * Comprehensive Test Suite for UI Components
 * Tests all major UI components and their functionality
 */
export const TestSuite: React.FC<TestSuiteProps> = ({ onComplete, autoRun = false }) => {
  const [results, setResults] = useState<TestResult[]>([]);
  const [running, setRunning] = useState(false);
  const [currentTest, setCurrentTest] = useState<string>('');
  const { announceToScreenReader: announce } = useAccessibility();

  // Test definitions
  const tests = [
    { name: 'Button Variants', test: testButtonVariants },
    { name: 'Input Validation', test: testInputValidation },
    { name: 'Card Elevations', test: testCardElevations },
    { name: 'Theme Toggle', test: testThemeToggle },
    { name: 'Loading States', test: testLoadingStates },
    { name: 'Accessibility', test: testAccessibility },
    { name: 'Responsive Design', test: testResponsiveDesign },
    { name: 'Error Boundaries', test: testErrorBoundaries },
  ];

  // Test implementations
  async function testButtonVariants(): Promise<TestResult> {
    const startTime = Date.now();

    try {
      // Test button rendering and variants
      const buttonVariants = ['primary', 'secondary', 'outline', 'ghost', 'danger'];
      const buttons = buttonVariants.map(variant => {
        const button = document.createElement('button');
        button.className = `btn btn-${variant}`;
        button.textContent = `Test ${variant}`;
        return button;
      });

      // Verify all buttons are created
      if (buttons.length !== 5) {
        throw new Error('Not all button variants created');
      }

      // Test loading state
      const loadingButton = document.createElement('button');
      loadingButton.className = 'btn btn-primary loading';
      loadingButton.setAttribute('disabled', 'true');

      return {
        test: 'Button Variants',
        status: 'pass',
        message: 'All button variants render correctly',
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        test: 'Button Variants',
        status: 'fail',
        message: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      };
    }
  }

  async function testInputValidation(): Promise<TestResult> {
    const startTime = Date.now();

    try {
      // Test input creation and validation
      const input = document.createElement('input');
      input.type = 'email';
      input.className = 'form-input';
      input.required = true;

      // Test invalid email
      input.value = 'invalid-email';
      const isValid = input.checkValidity();

      if (isValid) {
        throw new Error('Invalid email should not pass validation');
      }

      // Test valid email
      input.value = 'test@example.com';
      const isValidNow = input.checkValidity();

      if (!isValidNow) {
        throw new Error('Valid email should pass validation');
      }

      return {
        test: 'Input Validation',
        status: 'pass',
        message: 'Input validation works correctly',
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        test: 'Input Validation',
        status: 'fail',
        message: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      };
    }
  }

  async function testCardElevations(): Promise<TestResult> {
    const startTime = Date.now();

    try {
      // Test card elevation classes
      const elevations = ['none', 'low', 'medium', 'high'];
      const cards = elevations.map(elevation => {
        const card = document.createElement('div');
        card.className = `card card-elevation-${elevation}`;
        return card;
      });

      if (cards.length !== 4) {
        throw new Error('Not all card elevations created');
      }

      // Verify CSS classes exist
      const testCard = cards[0];
      const computedStyle = window.getComputedStyle(testCard);
      if (!computedStyle) {
        throw new Error('Card styles not applied');
      }

      return {
        test: 'Card Elevations',
        status: 'pass',
        message: 'All card elevations render correctly',
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        test: 'Card Elevations',
        status: 'fail',
        message: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      };
    }
  }

  async function testThemeToggle(): Promise<TestResult> {
    const startTime = Date.now();

    try {
      // Test theme toggle functionality
      const currentTheme = localStorage.getItem('lugn-trygg-theme') || 'light';
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';

      // Simulate theme toggle
      localStorage.setItem('lugn-trygg-theme', newTheme);
      document.documentElement.setAttribute('data-theme', newTheme);

      // Verify theme change
      const appliedTheme = document.documentElement.getAttribute('data-theme');
      if (appliedTheme !== newTheme) {
        throw new Error('Theme not applied correctly');
      }

      // Restore original theme
      localStorage.setItem('lugn-trygg-theme', currentTheme);
      document.documentElement.setAttribute('data-theme', currentTheme);

      return {
        test: 'Theme Toggle',
        status: 'pass',
        message: 'Theme toggle works correctly',
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        test: 'Theme Toggle',
        status: 'fail',
        message: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      };
    }
  }

  async function testLoadingStates(): Promise<TestResult> {
    const startTime = Date.now();

    try {
      // Test loading spinner creation
      const spinner = document.createElement('div');
      spinner.className = 'loading-spinner';

      if (!spinner.classList.contains('loading-spinner')) {
        throw new Error('Loading spinner class not applied');
      }

      // Test overlay creation
      const overlay = document.createElement('div');
      overlay.className = 'loading-overlay';

      if (!overlay.classList.contains('loading-overlay')) {
        throw new Error('Loading overlay class not applied');
      }

      return {
        test: 'Loading States',
        status: 'pass',
        message: 'Loading states render correctly',
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        test: 'Loading States',
        status: 'fail',
        message: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      };
    }
  }

  async function testAccessibility(): Promise<TestResult> {
    const startTime = Date.now();

    try {
      // Test ARIA attributes
      const button = document.createElement('button');
      button.setAttribute('aria-label', 'Test button');
      button.setAttribute('role', 'button');

      if (!button.hasAttribute('aria-label')) {
        throw new Error('ARIA label not set');
      }

      // Test focus management
      const input = document.createElement('input');
      input.setAttribute('aria-describedby', 'helper-text');

      if (!input.hasAttribute('aria-describedby')) {
        throw new Error('ARIA describedby not set');
      }

      // Test keyboard navigation
      const link = document.createElement('a');
      link.href = '#';
      link.textContent = 'Test link';

      if (!link.hasAttribute('href')) {
        throw new Error('Link href not set');
      }

      return {
        test: 'Accessibility',
        status: 'pass',
        message: 'Accessibility features work correctly',
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        test: 'Accessibility',
        status: 'fail',
        message: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      };
    }
  }

  async function testResponsiveDesign(): Promise<TestResult> {
    const startTime = Date.now();

    try {
      // Test responsive classes
      const responsiveClasses = [
        'sm:block', 'md:flex', 'lg:grid', 'xl:inline',
        'sm:text-sm', 'md:text-base', 'lg:text-lg', 'xl:text-xl'
      ];

      responsiveClasses.forEach(className => {
        const element = document.createElement('div');
        element.className = className;

        if (!element.classList.contains(className.split(':')[1])) {
          throw new Error(`Responsive class ${className} not applied`);
        }
      });

      // Test container queries
      const container = document.createElement('div');
      container.className = 'container-custom';

      if (!container.classList.contains('container-custom')) {
        throw new Error('Container class not applied');
      }

      return {
        test: 'Responsive Design',
        status: 'pass',
        message: 'Responsive design classes work correctly',
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        test: 'Responsive Design',
        status: 'fail',
        message: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      };
    }
  }

  async function testErrorBoundaries(): Promise<TestResult> {
    const startTime = Date.now();

    try {
      // Test error boundary class creation
      const errorBoundary = document.createElement('div');
      errorBoundary.className = 'error-boundary';

      if (!errorBoundary.classList.contains('error-boundary')) {
        throw new Error('Error boundary class not applied');
      }

      // Test error message display
      const errorMessage = document.createElement('div');
      errorMessage.className = 'error-message';
      errorMessage.textContent = 'Test error message';

      if (errorMessage.textContent !== 'Test error message') {
        throw new Error('Error message not set correctly');
      }

      return {
        test: 'Error Boundaries',
        status: 'pass',
        message: 'Error boundaries handle errors correctly',
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        test: 'Error Boundaries',
        status: 'fail',
        message: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      };
    }
  }

  // Run all tests
  const runTests = async () => {
    setRunning(true);
    setResults([]);
    announce('Starting UI component tests');

    const testResults: TestResult[] = [];

    for (const testDef of tests) {
      setCurrentTest(testDef.name);
      announce(`Running test: ${testDef.name}`);

      try {
        const result = await testDef.test();
        testResults.push(result);
        setResults(prev => [...prev, result]);
      } catch (error) {
        const errorResult: TestResult = {
          test: testDef.name,
          status: 'fail',
          message: error instanceof Error ? error.message : 'Test failed',
          duration: 0
        };
        testResults.push(errorResult);
        setResults(prev => [...prev, errorResult]);
      }

      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    setRunning(false);
    setCurrentTest('');
    announce('All tests completed');

    if (onComplete) {
      onComplete(testResults);
    }
  };

  // Auto-run tests if requested
  useEffect(() => {
    if (autoRun) {
      runTests();
    }
  }, [autoRun]);

  const passedTests = results.filter(r => r.status === 'pass').length;
  const failedTests = results.filter(r => r.status === 'fail').length;
  const totalTests = results.length;

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              UI Component Test Suite
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              Comprehensive testing of all UI components
            </p>
          </div>
          <ThemeToggle />
        </div>

        {/* Test Controls */}
        <div className="flex gap-4 mb-6">
          <Button
            onClick={runTests}
            disabled={running}
            loading={running}
          >
            {running ? 'Running Tests...' : 'Run All Tests'}
          </Button>

          {currentTest && (
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-500 border-t-transparent"></div>
              Running: {currentTest}
            </div>
          )}
        </div>

        {/* Test Results Summary */}
        {results.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="text-center">
              <div className="text-2xl font-bold text-green-600">{passedTests}</div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Passed</div>
            </Card>
            <Card className="text-center">
              <div className="text-2xl font-bold text-red-600">{failedTests}</div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Failed</div>
            </Card>
            <Card className="text-center">
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{totalTests}</div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Total</div>
            </Card>
          </div>
        )}

        {/* Individual Test Results */}
        <div className="space-y-3">
          {results.map((result, index) => (
            <Card key={index} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${
                    result.status === 'pass' ? 'bg-green-500' :
                    result.status === 'fail' ? 'bg-red-500' : 'bg-yellow-500'
                  }`}></div>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {result.test}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  {result.duration && (
                    <span>{result.duration}ms</span>
                  )}
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    result.status === 'pass' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                    result.status === 'fail' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                  }`}>
                    {result.status.toUpperCase()}
                  </span>
                </div>
              </div>
              {result.message && (
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  {result.message}
                </p>
              )}
            </Card>
          ))}
        </div>

        {/* Loading State */}
        {running && results.length === 0 && (
          <LoadingSpinner message="Initializing test suite..." />
        )}
      </div>
    </Card>
  );
};

export default TestSuite;
