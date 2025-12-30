import React, { useState } from 'react';
import { TestSuite } from './ui/TestSuite';
import { Card, Button, Input } from './ui/tailwind';
import { ThemeToggle } from './ui/ThemeToggle';
import { LoadingSpinner } from './LoadingStates';

/**
 * Test Page for UI Components
 * Provides a dedicated page to test all UI components
 */
const TestPage: React.FC = () => {
  const [showTestSuite, setShowTestSuite] = useState(false);
  const [testResults, setTestResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleTestComplete = (results: any[]) => {
    setTestResults(results);
  };

  const runQuickTest = async () => {
    setLoading(true);
    // Simulate quick component test
    await new Promise(resolve => setTimeout(resolve, 2000));
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-4">
            UI Component Testing
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Comprehensive testing suite for all UI components in Lugn & Trygg.
            Test functionality, accessibility, and design consistency.
          </p>
        </div>

        {/* Theme Toggle */}
        <div className="flex justify-center mb-8">
          <ThemeToggle />
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="text-center p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
              Component Gallery
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              View all UI components in different states
            </p>
            <Button variant="outlined" fullWidth>
              View Gallery
            </Button>
          </Card>

          <Card className="text-center p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
              Quick Test
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Run basic component functionality test
            </p>
            <Button
              onClick={runQuickTest}
              loading={loading}
              fullWidth
            >
              Run Quick Test
            </Button>
          </Card>

          <Card className="text-center p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
              Full Test Suite
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Comprehensive testing of all components
            </p>
            <Button
              onClick={() => setShowTestSuite(!showTestSuite)}
              variant={showTestSuite ? "contained" : "contained"}
              color={showTestSuite ? "secondary" : "primary"}
              fullWidth
            >
              {showTestSuite ? 'Hide' : 'Show'} Test Suite
            </Button>
          </Card>

          <Card className="text-center p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
              Accessibility Audit
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Test WCAG 2.1 AA compliance
            </p>
            <Button variant="outlined" fullWidth>
              Run Audit
            </Button>
          </Card>
        </div>

        {/* Component Showcase */}
        <Card className="mb-8">
          <div className="p-6">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">
              Component Showcase
            </h2>

            {/* Buttons */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                Buttons
              </h3>
              <div className="flex flex-wrap gap-4">
                <Button>Primary</Button>
                <Button color="secondary">Secondary</Button>
                <Button variant="outlined">Outline</Button>
                <Button variant="text">Ghost</Button>
                <Button color="error">Danger</Button>
                <Button loading>Loading</Button>
              </div>
            </div>

            {/* Inputs */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                Inputs
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Text Input"
                  placeholder="Enter text..."
                />
                <Input
                  label="Email Input"
                  type="email"
                  placeholder="Enter email..."
                />
                <Input
                  label="Password Input"
                  type="password"
                  placeholder="Enter password..."
                />
                <Input
                  label="Disabled Input"
                  disabled
                  value="Disabled input"
                />
              </div>
            </div>

            {/* Cards */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                Cards
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="shadow-sm">
                  <div className="p-4">
                    <h4 className="font-semibold mb-2">Low Elevation</h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Subtle shadow for secondary content
                    </p>
                  </div>
                </Card>
                <Card className="shadow-md">
                  <div className="p-4">
                    <h4 className="font-semibold mb-2">Medium Elevation</h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Standard shadow for main content
                    </p>
                  </div>
                </Card>
                <Card className="shadow-lg">
                  <div className="p-4">
                    <h4 className="font-semibold mb-2">High Elevation</h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Prominent shadow for modals/dialogs
                    </p>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </Card>

        {/* Test Suite */}
        {showTestSuite && (
          <TestSuite
            onComplete={handleTestComplete}
            autoRun={false}
          />
        )}

        {/* Test Results Summary */}
        {testResults.length > 0 && (
          <Card className="mt-8">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
                Test Results Summary
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">
                    {testResults.filter(r => r.status === 'pass').length}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">Passed</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-600">
                    {testResults.filter(r => r.status === 'fail').length}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">Failed</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                    {testResults.length}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">Total</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">
                    {testResults.length > 0 ?
                      Math.round((testResults.filter(r => r.status === 'pass').length / testResults.length) * 100) : 0
                    }%
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">Success Rate</div>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default TestPage;
