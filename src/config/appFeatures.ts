import type { FeatureName } from '@/components/PremiumGate';

export interface NavLinkConfig {
  path: string;
  labelKey: string;
  icon: string;
  feature?: FeatureName;
}

export const NAV_LINKS: NavLinkConfig[] = [
  { path: '/dashboard', labelKey: 'navLinks.dashboard', icon: '📊' },
  { path: '/wellness', labelKey: 'navLinks.wellness', icon: '🧘', feature: 'wellness' },
  { path: '/mood-logger', labelKey: 'navLinks.mood', icon: '😊' },
  { path: '/ai-chat', labelKey: 'navLinks.aiChat', icon: '💬' },
  { path: '/insights', labelKey: 'navLinks.insights', icon: '📈', feature: 'insights' },
  { path: '/profile', labelKey: 'navLinks.profile', icon: '👤' },
];

export interface QuickActionConfig {
  id: 'mood' | 'mood-list' | 'chat' | 'meditation' | 'journal' | 'sounds' | 'social' | 'insights' | 'recommendations';
  titleKey: string;
  icon: string;
  colorClass: string;
  ariaLabelKey?: string;
  feature?: FeatureName;
  defaultDescriptionKey: string;
}

export const QUICK_ACTIONS: QuickActionConfig[] = [
  {
    id: 'mood',
    titleKey: 'quickAction.mood.title',
    icon: '🧘‍♀️',
    colorClass: 'text-secondary-500',
    ariaLabelKey: 'quickAction.mood.ariaLabel',
    defaultDescriptionKey: 'quickAction.mood.description',
  },
  {
    id: 'chat',
    titleKey: 'quickAction.chat.title',
    icon: '💬',
    colorClass: 'text-success-500',
    ariaLabelKey: 'quickAction.chat.ariaLabel',
    defaultDescriptionKey: 'quickAction.chat.description',
  },
  {
    id: 'sounds',
    titleKey: 'quickAction.sounds.title',
    icon: '🎵',
    colorClass: 'text-primary-500',
    ariaLabelKey: 'quickAction.sounds.ariaLabel',
    feature: 'sounds',
    defaultDescriptionKey: 'quickAction.sounds.description',
  },
  {
    id: 'journal',
    titleKey: 'quickAction.journal.title',
    icon: '📖',
    colorClass: 'text-accent-500',
    ariaLabelKey: 'quickAction.journal.ariaLabel',
    feature: 'journal',
    defaultDescriptionKey: 'quickAction.journal.description',
  },
  {
    id: 'recommendations',
    titleKey: 'quickAction.recommendations.title',
    icon: '✨',
    colorClass: 'text-primary-500',
    ariaLabelKey: 'quickAction.recommendations.ariaLabel',
    feature: 'recommendations',
    defaultDescriptionKey: 'quickAction.recommendations.description',
  },
  {
    id: 'social',
    titleKey: 'quickAction.social.title',
    icon: '👥',
    colorClass: 'text-neutral-500',
    ariaLabelKey: 'quickAction.social.ariaLabel',
    feature: 'social',
    defaultDescriptionKey: 'quickAction.social.description',
  },
];
