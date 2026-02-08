/**
 * Trust Links Component
 * Displays links to privacy policy, terms of service, and support
 * Used in login/register forms to build user trust
 */

import { Link } from 'react-router-dom';

interface TrustLinksProps {
  className?: string;
  variant?: 'compact' | 'full';
  showSupport?: boolean;
}

/**
 * Trust links for legal pages and support
 */
const TrustLinks: React.FC<TrustLinksProps> = ({
  className = '',
  variant = 'compact',
  showSupport = true,
}) => {
  const links = [
    {
      to: '/privacy',
      label: 'Integritetspolicy',
      icon: '🔒',
    },
    {
      to: '/terms',
      label: 'Användarvillkor',
      icon: '📜',
    },
    ...(showSupport
      ? [
          {
            to: '/support',
            label: 'Hjälp & Support',
            icon: '💬',
          },
        ]
      : []),
  ];

  if (variant === 'full') {
    return (
      <div className={`space-y-3 ${className}`}>
        <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
          Genom att logga in godkänner du våra villkor
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 hover:underline transition-colors"
            >
              <span>{link.icon}</span>
              <span>{link.label}</span>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  // Compact variant (default)
  return (
    <div className={`text-center ${className}`}>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Genom att fortsätta godkänner du våra{' '}
        <Link
          to="/terms"
          className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 hover:underline"
        >
          användarvillkor
        </Link>{' '}
        och{' '}
        <Link
          to="/privacy"
          className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 hover:underline"
        >
          integritetspolicy
        </Link>
        .
      </p>
      {showSupport && (
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Behöver du hjälp?{' '}
          <Link
            to="/support"
            className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 hover:underline"
          >
            Kontakta support
          </Link>
        </p>
      )}
    </div>
  );
};

export default TrustLinks;
