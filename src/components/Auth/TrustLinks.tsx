import React from 'react';

const TrustLinks: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={className}>
      <nav className="mt-3 mb-2 flex flex-wrap justify-center gap-4 text-xs text-gray-600 dark:text-gray-300" aria-label="Trygghetslänkar">
        <a href="/privacy" className="underline underline-offset-2 hover:text-primary-600 dark:hover:text-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 px-1" target="_blank" rel="noopener noreferrer">Integritet</a>
        <a href="/ai-info" className="underline underline-offset-2 hover:text-primary-600 dark:hover:text-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 px-1" target="_blank" rel="noopener noreferrer" title="AI används för att ge stöd, insikter och strategier. Ingen personlig rådgivning eller vård.">Hur AI används</a>
        <a href="/emergency" className="underline underline-offset-2 hover:text-error-600 dark:hover:text-error-400 focus:outline-none focus:ring-2 focus:ring-error-500 px-1" target="_blank" rel="noopener noreferrer">Akut hjälp</a>
      </nav>
      <p className="mt-2 text-xs font-medium text-gray-600 dark:text-gray-300 text-center" style={{letterSpacing: '0.01em'}} aria-live="polite">
        Detta ersätter inte vård, men kan hjälpa i vardagen.
      </p>
    </div>
  );
};

export default TrustLinks;
