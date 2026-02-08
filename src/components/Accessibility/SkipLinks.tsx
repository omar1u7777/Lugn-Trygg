import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { SkipLink } from './SkipLink';

/**
 * Props for the SkipLinks component.
 */
interface SkipLinksProps {
  /**
   * Optional array of skip links. Each link should have an href (anchor) and label.
   */
  links?: Array<{
    href: string;
    label: string;
  }>;
}

/**
 * Default fallback skip links used when no custom links are provided.
 */
const FALLBACK_LINKS = [
  { href: '#main-content', labelKey: 'common.skipToContent', fallback: 'Hoppa till huvudinnehåll' },
  { href: '#navigation', labelKey: 'common.skipToNavigation', fallback: 'Hoppa till navigation' },
  { href: '#search', labelKey: 'common.skipToSearch', fallback: 'Hoppa till sök' },
];

/**
 * SkipLinks component provides keyboard navigation shortcuts to important sections of the page.
 * It renders a list of SkipLink components that allow users to skip to specific content areas.
 */
const SkipLinks: React.FC<SkipLinksProps> = ({ links }) => {
  const { t } = useTranslation();

  // Memoize the resolved links to avoid unnecessary recalculations on re-renders
  const displayLinks = useMemo(() => {
    if (links && Array.isArray(links) && links.length > 0) {
      // Filter out invalid links and ensure href and label are strings
      return links.filter(link => typeof link.href === 'string' && typeof link.label === 'string' && link.href.trim() && link.label.trim());
    }
    // Use fallback links with translated labels
    return FALLBACK_LINKS.map(link => ({
      href: link.href,
      label: t(link.labelKey, link.fallback),
    }));
  }, [links, t]);

  return (
    <div aria-label={t('accessibility.skipLinksLabel', 'Tillgängliga genvägar')} className="flex gap-2">
      {displayLinks.map((link) => (
        <SkipLink key={link.href} targetId={link.href.slice(1)}>
          {link.label}
        </SkipLink>
      ))}
    </div>
  );
};

export default SkipLinks;
