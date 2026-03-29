import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  PhoneIcon, 
  ChatBubbleLeftRightIcon, 
  GlobeAltIcon, 
  HeartIcon,
  LifebuoyIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';

/**
 * 🆘 Crisis Support Page - Professional Mental Health Resources
 * 
 * Psychological principles:
 * - Immediate accessibility: All options visible at once
 * - Multiple channels: Phone, chat, web (works on desktop & mobile)
 * - Normalizing: "It's okay to ask for help"
 * - Clear hierarchy: Emergency → Crisis → Support
 */
const CrisisPage: React.FC = () => {
  const navigate = useNavigate();

  const crisisResources = [
    {
      id: 'emergency',
      priority: 'critical',
      title: '🚨 Akut nödläge',
      subtitle: 'Ring 112 vid omedelbart livshotande situation',
      icon: <PhoneIcon className="w-6 h-6" />,
      color: 'bg-red-600 hover:bg-red-700',
      textColor: 'text-red-600',
      borderColor: 'border-red-500',
      action: 'Ring 112',
      href: 'tel:112',
      description: 'Vid akuta självmordstankter eller livshotande situation',
      available: 'Dygnet runt'
    },
    {
      id: 'suicide-hotline',
      priority: 'urgent',
      title: '💙 Självmordslinjen',
      subtitle: 'Telefonjour för dig i kris',
      icon: <PhoneIcon className="w-6 h-6" />,
      color: 'bg-rose-600 hover:bg-rose-700',
      textColor: 'text-rose-600',
      borderColor: 'border-rose-500',
      action: 'Ring 90101',
      href: 'tel:90101',
      description: 'Samtal om självmordstankter och existentiell ångest',
      available: 'Dygnet runt'
    },
    {
      id: 'mind-chat',
      priority: 'high',
      title: '💬 Mind Självmordslinjen',
      subtitle: 'Chattjour online',
      icon: <ChatBubbleLeftRightIcon className="w-6 h-6" />,
      color: 'bg-purple-600 hover:bg-purple-700',
      textColor: 'text-purple-600',
      borderColor: 'border-purple-500',
      action: 'Öppna chatt',
      href: 'https://www.mind.se/hjalp-och-stod/att-beratta-och-be-om-hjalp/sjalvmordslinjen-chatt/',
      external: true,
      description: 'Anonym chatt för dig med självmordstankter',
      available: 'Mån-fre 13-21, Lör 13-17'
    },
    {
      id: 'healthcare-1177',
      priority: 'medium',
      title: '🏥 Vårdguiden 1177',
      subtitle: 'Sjukvårdsrådgivning',
      icon: <PhoneIcon className="w-6 h-6" />,
      color: 'bg-green-600 hover:bg-green-700',
      textColor: 'text-green-600',
      borderColor: 'border-green-500',
      action: 'Ring 1177',
      href: 'tel:1177',
      description: 'Sjuksköterskerådgivning och vårdbokning',
      available: 'Dygnet runt'
    },
    {
      id: 'priest',
      priority: 'medium',
      title: '⛪ Jourhavande Präst',
      subtitle: 'Själavård och existentiellt stöd',
      icon: <HeartIcon className="w-6 h-6" />,
      color: 'bg-blue-600 hover:bg-blue-700',
      textColor: 'text-blue-600',
      borderColor: 'border-blue-500',
      action: 'Ring 112',
      href: 'tel:112',
      description: 'Samtal om livsfrågor, sorg och existentiell oro',
      available: 'Dygnet runt'
    },
    {
      id: 'bris',
      priority: 'support',
      title: '🧸 BRIS - Barnens hjälptelefon',
      subtitle: 'Stöd för barn och unga upp till 25 år',
      icon: <ChatBubbleLeftRightIcon className="w-6 h-6" />,
      color: 'bg-orange-500 hover:bg-orange-600',
      textColor: 'text-orange-500',
      borderColor: 'border-orange-500',
      action: 'Ring 116 111',
      href: 'tel:116111',
      description: 'Telefon och chatt för barn, unga och unga vuxna',
      available: 'Dygnet runt'
    },
    {
      id: 'spes',
      priority: 'support',
      title: '🕯️ SPES - SuicidPrevention',
      subtitle: 'Anhörigstöd efter suicid',
      icon: <LifebuoyIcon className="w-6 h-6" />,
      color: 'bg-teal-600 hover:bg-teal-700',
      textColor: 'text-teal-600',
      borderColor: 'border-teal-500',
      action: 'Besök webbplats',
      href: 'https://www.spes.se/',
      external: true,
      description: 'Stöd för anhöriga och närstående efter suicid',
      available: 'Webbplats'
    },
    {
      id: 'medmänniska',
      priority: 'support',
      title: '🤝 Jourhavande Medmänniska',
      subtitle: 'Samtalsstöd i natten',
      icon: <HeartIcon className="w-6 h-6" />,
      color: 'bg-indigo-600 hover:bg-indigo-700',
      textColor: 'text-indigo-600',
      borderColor: 'border-indigo-500',
      action: 'Ring 08-702 00 20',
      href: 'tel:08-7020020',
      description: 'Samtalshjälp för existentiella frågor och ensamhet',
      available: '21-06 (natten)'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5" />
              <span className="text-sm font-medium">Tillbaka</span>
            </button>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Hjälp och Stöd
            </h1>
            <div className="w-20" /> {/* Spacer for centering */}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Hero Message */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-rose-100 dark:bg-rose-900/30 rounded-full mb-4">
            <HeartIcon className="w-8 h-8 text-rose-600" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-3">
            Du är inte ensam
          </h2>
          <p className="text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
            Att må dåligt är inte ett tecken på svaghet. Det finns alltid någon som vill hjälpa dig, 
            dygnet runt. Välj det sätt som känns bäst för dig – telefon, chatt eller webb.
          </p>
        </div>

        {/* Emergency Alert */}
        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded-r-lg p-4 mb-8">
          <p className="text-red-800 dark:text-red-200 text-sm">
            <strong>🚨 Vid akut fara för livet:</strong> Ring alltid <a href="tel:112" className="font-bold underline">112</a> omedelbart.
          </p>
        </div>

        {/* Crisis Resources Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {crisisResources.map((resource) => (
            <div
              key={resource.id}
              className={`bg-white dark:bg-slate-800 rounded-xl border-2 ${resource.borderColor} p-5 shadow-sm hover:shadow-md transition-shadow`}
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg ${resource.color} text-white shrink-0`}>
                  {resource.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-900 dark:text-white text-lg">
                    {resource.title}
                  </h3>
                  <p className={`text-sm ${resource.textColor} font-medium mb-1`}>
                    {resource.subtitle}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                    {resource.description}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      🕐 {resource.available}
                    </span>
                    {resource.external ? (
                      <a
                        href={resource.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-sm font-medium ${resource.color} transition-colors`}
                      >
                        <GlobeAltIcon className="w-4 h-4" />
                        {resource.action}
                      </a>
                    ) : (
                      <a
                        href={resource.href}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-sm font-medium ${resource.color} transition-colors`}
                      >
                        <PhoneIcon className="w-4 h-4" />
                        {resource.action}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Additional Resources */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="font-bold text-slate-900 dark:text-white text-lg mb-4">
            Andra sätt att få stöd
          </h3>
          <div className="space-y-3">
            <a 
              href="/ai-chat"
              className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                <ChatBubbleLeftRightIcon className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <p className="font-medium text-slate-900 dark:text-white">Prata med Lugn & Trygg AI</p>
                <p className="text-xs text-slate-500">Direkt stöd och samtal i appen</p>
              </div>
            </a>
            
            <a 
              href="https://www.1177.se/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <GlobeAltIcon className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-slate-900 dark:text-white">1177.se</p>
                <p className="text-xs text-slate-500">Sjukvårdsupplysning och e-tjänster</p>
              </div>
            </a>
          </div>
        </div>

        {/* Supportive Message */}
        <div className="mt-8 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400 italic">
            "Det är modigt att be om hjälp. Du förtjänar att må bra."
          </p>
        </div>
      </main>
    </div>
  );
};

export default CrisisPage;
