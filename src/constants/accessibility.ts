export type DashboardRegionKey = 'stats' | 'quickActions' | 'activity';

interface RegionDescription {
  headingId: string;
  regionLabel: string;
  description: string;
}

/**
 * Centralizes aria-label metadata for dashboard widgets.
 * Keeps labels consistent and simplifies WCAG audits.
 */
export const DASHBOARD_REGION_MAP: Record<DashboardRegionKey, RegionDescription> = {
  stats: {
    headingId: 'dashboard-stats-heading',
    regionLabel: 'Nyckelstatistik',
    description: 'Visar aktuellt humör, streak, AI-sessioner och achievements.'
  },
  quickActions: {
    headingId: 'dashboard-quick-actions-heading',
    regionLabel: 'Snabbåtgärder',
    description: 'Direktåtkomst till humörloggning, AI-chatt och andra vanliga funktioner.'
  },
  activity: {
    headingId: 'dashboard-activity-heading',
    regionLabel: 'Senaste aktivitet',
    description: 'Tidslinje med dina senaste humörloggar, chattar och achievements.'
  }
};

export const getDashboardRegionProps = (key: DashboardRegionKey) => {
  const region = DASHBOARD_REGION_MAP[key];
  return {
    role: 'region' as const,
    'aria-labelledby': region.headingId,
    'aria-describedby': `${region.headingId}-description`
  };
};
