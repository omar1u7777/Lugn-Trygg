import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ChartBarIcon,
  ArrowLeftIcon,
  InformationCircleIcon,
  ChartPieIcon,
  PresentationChartLineIcon
} from '@heroicons/react/24/outline';

/**
 * ADMIN ANALYTICS DASHBOARD - Temporary Placeholder
 * 
 * This advanced admin analytics dashboard is temporarily disabled due to chart library bundling issues.
 * Regular users should use the main Analytics page at /analytics which includes:
 * - Mood trends and predictions
 * - AI-powered insights
 * - Personal statistics
 * - Gamification progress
 * 
 * Admin features will be restored after chart library migration is complete.
 */

const AnalyticsDashboard: React.FC = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: <ChartBarIcon className="w-8 h-8" />,
      title: 'Humörtrender',
      description: 'Se din humörutveckling över tid med AI-drivna prognoser',
      color: 'from-blue-500 to-cyan-500'
    },
    {
      icon: <ChartPieIcon className="w-8 h-8" />,
      title: 'Personlig Statistik',
      description: 'Detaljerad analys av dina humörloggar och mönster',
      color: 'from-purple-500 to-pink-500'
    },
    {
      icon: <PresentationChartLineIcon className="w-8 h-8" />,
      title: 'AI Insikter',
      description: 'Smarta rekommendationer baserade på dina data',
      color: 'from-green-500 to-emerald-500'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors mb-4"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            <span className="font-medium">Tillbaka</span>
          </button>
          
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Admin Analytics Dashboard
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Avancerad analysplattform för administratörer
          </p>
        </div>

        {/* Info Alert */}
        <div className="mb-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <InformationCircleIcon className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
                Dashboard Under Utveckling
              </h3>
              <p className="text-blue-800 dark:text-blue-200 mb-4">
                Denna avancerade admin-dashboard är temporärt inaktiverad på grund av chart library bundling-problem. 
                Vi arbetar på att migrera till en ny chart-lösning.
              </p>
              <p className="text-blue-800 dark:text-blue-200 mb-4">
                Under tiden kan du använda huvudanalytik-sidan som innehåller alla personliga analytics-funktioner:
              </p>
              <button
                onClick={() => navigate('/analytics')}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors inline-flex items-center gap-2"
              >
                <ChartBarIcon className="w-5 h-5" />
                <span>Gå till Analytics</span>
              </button>
            </div>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            Tillgängliga Funktioner i Huvudanalytik
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden"
              >
                <div className={`bg-gradient-to-r ${feature.color} p-6 flex items-center justify-center`}>
                  <div className="text-white">
                    {feature.icon}
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Additional Info */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            Planerade Admin-Funktioner
          </h3>
          <ul className="space-y-3 text-gray-600 dark:text-gray-400">
            <li className="flex items-start gap-2">
              <span className="text-primary-500 font-bold">•</span>
              <span>Aggregerad användarstatistik och engagement metrics</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500 font-bold">•</span>
              <span>Real-time system performance monitoring</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500 font-bold">•</span>
              <span>Exportfunktioner för dataanalys (CSV, JSON)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500 font-bold">•</span>
              <span>Trendanalys och prediktiva modeller</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500 font-bold">•</span>
              <span>Feature usage tracking och A/B testing results</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
