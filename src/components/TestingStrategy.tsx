import React, { useState, useEffect } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { TestSuite } from './ui/TestSuite';

/**
 * Testing Strategy Component
 * Comprehensive testing strategy for Lugn & Trygg
 */
const TestingStrategy: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'unit' | 'integration' | 'e2e' | 'performance' | 'accessibility'>('overview');
  const [testResults, setTestResults] = useState<any[]>([]);

  const tabs = [
    { id: 'overview', label: 'Översikt', icon: '📋' },
    { id: 'unit', label: 'Enhetstester', icon: '🧪' },
    { id: 'integration', label: 'Integrationstester', icon: '🔗' },
    { id: 'e2e', label: 'E2E Tester', icon: '🌐' },
    { id: 'performance', label: 'Prestanda', icon: '⚡' },
    { id: 'accessibility', label: 'Tillgänglighet', icon: '♿' },
  ];

  const handleTestComplete = (results: any[]) => {
    setTestResults(results);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-6">
            <Card>
              <div className="p-6">
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">
                  🧪 Teststrategi för Lugn & Trygg
                </h3>
                <p className="text-slate-600 dark:text-slate-400 mb-6">
                  En omfattande teststrategi som säkerställer hög kvalitet, tillförlitlighet och användarupplevelse
                  för vår mentalhälsoplattform.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                    <div className="text-2xl mb-2">🎯</div>
                    <h4 className="font-semibold text-blue-900 dark:text-blue-100">Mål</h4>
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      95% testtäckning, 0 kritiska buggar i produktion
                    </p>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                    <div className="text-2xl mb-2">📊</div>
                    <h4 className="font-semibold text-green-900 dark:text-green-100">Mätvärden</h4>
                    <p className="text-sm text-green-800 dark:text-green-200">
                      Prestanda, tillgänglighet, användbarhet
                    </p>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                    <div className="text-2xl mb-2">🔄</div>
                    <h4 className="font-semibold text-purple-900 dark:text-purple-100">Automatisering</h4>
                    <p className="text-sm text-purple-800 dark:text-purple-200">
                      CI/CD pipeline med automatiska tester
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <div className="p-6">
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">
                  📈 Testpyramid
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="text-2xl">🧪</div>
                    <div>
                      <h4 className="font-semibold text-green-900 dark:text-green-100">Enhetstester (70%)</h4>
                      <p className="text-sm text-green-800 dark:text-green-200">
                        Funktioner, komponenter, hooks, utilities
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="text-2xl">🔗</div>
                    <div>
                      <h4 className="font-semibold text-blue-900 dark:text-blue-100">Integrationstester (20%)</h4>
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        API-anrop, databasinteraktioner, komponentinteraktioner
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <div className="text-2xl">🌐</div>
                    <div>
                      <h4 className="font-semibold text-purple-900 dark:text-purple-100">E2E-tester (10%)</h4>
                      <p className="text-sm text-purple-800 dark:text-purple-200">
                        Fullständiga användarflöden, kritiska scenarier
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        );

      case 'unit':
        return (
          <div className="space-y-6">
            <Card>
              <div className="p-6">
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">
                  🧪 Enhetstester
                </h3>
                <p className="text-slate-600 dark:text-slate-400 mb-6">
                  Tester för individuella funktioner och komponenter
                </p>

                <div className="space-y-4">
                  <div className="border-l-4 border-green-500 pl-4">
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100">✅ Implementerade</h4>
                    <ul className="text-sm text-slate-600 dark:text-slate-400 mt-2 space-y-1">
                      <li>• React-komponenter med Jest + React Testing Library</li>
                      <li>• Custom hooks testning</li>
                      <li>• Utility-funktioner</li>
                      <li>• Form validation</li>
                      <li>• API service funktioner</li>
                    </ul>
                  </div>

                  <div className="border-l-4 border-yellow-500 pl-4">
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100">🚧 Pågående</h4>
                    <ul className="text-sm text-slate-600 dark:text-slate-400 mt-2 space-y-1">
                      <li>• Komplett testtäckning för alla komponenter</li>
                      <li>• Edge case testing</li>
                      <li>• Error boundary testing</li>
                      <li>• Accessibility testing</li>
                    </ul>
                  </div>
                </div>
              </div>
            </Card>

            <TestSuite onComplete={handleTestComplete} />
          </div>
        );

      case 'integration':
        return (
          <div className="space-y-6">
            <Card>
              <div className="p-6">
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">
                  🔗 Integrationstester
                </h3>
                <p className="text-slate-600 dark:text-slate-400 mb-6">
                  Tester för komponentinteraktioner och externa tjänster
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">API Integration</h4>
                    <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-2">
                      <li>✅ Firebase Auth integration</li>
                      <li>✅ Backend API endpoints</li>
                      <li>✅ OAuth providers</li>
                      <li>✅ Health data APIs</li>
                      <li>⏳ Real-time subscriptions</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">Komponent Integration</h4>
                    <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-2">
                      <li>✅ Context providers</li>
                      <li>✅ Form submissions</li>
                      <li>✅ Navigation flows</li>
                      <li>✅ Theme switching</li>
                      <li>⏳ Modal interactions</li>
                    </ul>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        );

      case 'e2e':
        return (
          <div className="space-y-6">
            <Card>
              <div className="p-6">
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">
                  🌐 End-to-End Tester
                </h3>
                <p className="text-slate-600 dark:text-slate-400 mb-6">
                  Fullständiga användarflöden från start till slut
                </p>

                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">
                      Kritiska användarflöden
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <h5 className="font-medium text-slate-800 dark:text-slate-200">Autentisering</h5>
                        <ul className="text-slate-600 dark:text-slate-400 mt-1 space-y-1">
                          <li>• Registrering → Verifiering → Inloggning</li>
                          <li>• Lösenordsåterställning</li>
                          <li>• Tvåfaktorsautentisering</li>
                        </ul>
                      </div>
                      <div>
                        <h5 className="font-medium text-slate-800 dark:text-slate-200">Core Features</h5>
                        <ul className="text-slate-600 dark:text-slate-400 mt-1 space-y-1">
                          <li>• Humörloggning → Analys</li>
                          <li>• Minnesinspelning → Visning</li>
                          <li>• AI-chatt → Respons</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        );

      case 'performance':
        return (
          <div className="space-y-6">
            <Card>
              <div className="p-6">
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">
                  ⚡ Prestandatester
                </h3>
                <p className="text-slate-600 dark:text-slate-400 mb-6">
                  Säkerställer optimal prestanda och användarupplevelse
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="text-2xl mb-2">📱</div>
                    <h4 className="font-semibold text-green-900 dark:text-green-100">Lighthouse Score</h4>
                    <p className="text-sm text-green-800 dark:text-green-200">95+ på alla metrics</p>
                  </div>
                  <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="text-2xl mb-2">⚡</div>
                    <h4 className="font-semibold text-blue-900 dark:text-blue-100">Load Time</h4>
                    <p className="text-sm text-blue-800 dark:text-blue-200">{`< 2s första laddning`}</p>
                  </div>
                  <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <div className="text-2xl mb-2">🎯</div>
                    <h4 className="font-semibold text-purple-900 dark:text-purple-100">Core Web Vitals</h4>
                    <p className="text-sm text-purple-800 dark:text-purple-200">Alla i grönt</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        );

      case 'accessibility':
        return (
          <div className="space-y-6">
            <Card>
              <div className="p-6">
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">
                  ♿ Tillgänglighetstester
                </h3>
                <p className="text-slate-600 dark:text-slate-400 mb-6">
                  WCAG 2.1 AA compliance för alla användare
                </p>

                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                      🧪 Automatiska Tester
                    </h4>
                    <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                      <li>• axe-core för komponenttester</li>
                      <li>• Color contrast validation</li>
                      <li>• Keyboard navigation testing</li>
                      <li>• Screen reader compatibility</li>
                      <li>• Focus management</li>
                    </ul>
                  </div>

                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2">
                      ✅ Manuella Tester
                    </h4>
                    <ul className="text-sm text-green-800 dark:text-green-200 space-y-1">
                      <li>• Screen reader testing (NVDA, JAWS)</li>
                      <li>• Keyboard-only navigation</li>
                      <li>• Color blindness simulation</li>
                      <li>• Mobile accessibility testing</li>
                      <li>• Cognitive load assessment</li>
                    </ul>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-4">
            🧪 Teststrategi
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Omfattande teststrategi för att säkerställa kvalitet, tillförlitlighet och användbarhet
            i Lugn & Trygg-plattformen.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 mb-8 justify-center">
          {tabs.map((tab) => (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? 'primary' : 'outline'}
              onClick={() => setActiveTab(tab.id as any)}
              className="flex items-center gap-2"
            >
              <span>{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </Button>
          ))}
        </div>

        {/* Tab Content */}
        {renderTabContent()}

        {/* Test Results Summary */}
        {testResults.length > 0 && (
          <Card className="mt-8">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
                📊 Testresultat Sammanfattning
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">
                    {testResults.filter(r => r.status === 'pass').length}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">Godkända</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-600">
                    {testResults.filter(r => r.status === 'fail').length}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">Misslyckade</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                    {testResults.length}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">Totalt</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">
                    {testResults.length > 0 ?
                      Math.round((testResults.filter(r => r.status === 'pass').length / testResults.length) * 100) : 0
                    }%
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">Framgångsgrad</div>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default TestingStrategy;