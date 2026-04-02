import React from 'react';
import { useTranslation } from 'react-i18next';

export const AIMusicGenerator: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isSwedish = i18n.language === 'sv';

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-6">🤖</div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
          {isSwedish ? 'Kommer Snart' : 'Coming Soon'}
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
          {isSwedish
            ? 'AI-musikgeneratorn utvecklas för närvarande. Den kommer att erbjuda personligt genererad meditation baserat på ditt humör och behov.'
            : 'The AI Music Generator is currently in development. It will offer personalized meditation generated based on your mood and needs.'}
        </p>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            {isSwedish
              ? '💡 Tips: Använd "Ljudbibliotek"-fliken för redan kurerad musik och genererad binaural beats'
              : '💡 Tip: Use the "Sound Library" tab for curated music and generated binaural beats'}
          </p>
        </div>

        <div className="space-y-3 text-left mb-6">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">
            {isSwedish ? 'Planerade funktioner:' : 'Planned features:'}
          </h3>
          <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <span>{isSwedish ? 'AI-genererad meditation' : 'AI-generated meditation'}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <span>{isSwedish ? 'Humörbaserad anpassning' : 'Mood-based customization'}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <span>{isSwedish ? 'Biofeedback-integration' : 'Biofeedback integration'}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <span>{isSwedish ? 'Forskningsbaserade frekvenser' : 'Research-backed frequencies'}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AIMusicGenerator;
