import type { FeatureName } from '@/components/PremiumGate';

export interface NavLinkConfig {
  path: string;
  label: string;
  icon: string;
  feature?: FeatureName;
}

export const NAV_LINKS: NavLinkConfig[] = [
  { path: '/dashboard', label: 'Översikt', icon: '📊' },
  { path: '/wellness', label: 'Välmående', icon: '🧘', feature: 'wellness' },
  { path: '/mood-logger', label: 'Humör', icon: '😊' },
  { path: '/ai-chat', label: 'AI-chatt', icon: '💬' },
  { path: '/insights', label: 'Insikter', icon: '📈', feature: 'insights' },
  { path: '/profile', label: 'Profil', icon: '👤' },
];

export interface QuickActionConfig {
  id: 'mood' | 'mood-list' | 'chat' | 'meditation' | 'journal' | 'sounds' | 'social' | 'insights' | 'recommendations';
  title: string;
  icon: string;
  colorClass: string;
  ariaLabel?: string;
  feature?: FeatureName;
  defaultDescription: string;
}

export const QUICK_ACTIONS: QuickActionConfig[] = [
  {
    id: 'mood',
    title: 'Känn efter',
    icon: '🧘‍♀️',
    colorClass: 'text-secondary-500',
    ariaLabel: 'Checka in med ditt mående',
    defaultDescription: 'Hur mår du i stunden?',
  },
  {
    id: 'chat',
    title: 'Få stöd',
    icon: '💬',
    colorClass: 'text-success-500',
    ariaLabel: 'Starta samtal med AI-stöd',
    defaultDescription: 'Prata av dig, när som helst',
  },
  {
    id: 'sounds',
    title: 'Lugnande ljud',
    icon: '🎵',
    colorClass: 'text-primary-500',
    ariaLabel: 'Lyssna på lugnande ljud och musik',
    feature: 'sounds',
    defaultDescription: 'Slappna av med musik',
  },
  {
    id: 'journal',
    title: 'Dagbok',
    icon: '📖',
    colorClass: 'text-accent-500',
    ariaLabel: 'Skriv i din dagbok',
    feature: 'journal',
    defaultDescription: 'Skriv dina tankar',
  },
  {
    id: 'recommendations',
    title: 'Tips & råd',
    icon: '✨',
    colorClass: 'text-primary-500',
    ariaLabel: 'Se personliga rekommendationer',
    feature: 'recommendations',
    defaultDescription: 'Anpassat just för dig',
  },
  {
    id: 'social',
    title: 'Gemenskap',
    icon: '👥',
    colorClass: 'text-neutral-500',
    ariaLabel: 'Gå med i gemenskapen',
    feature: 'social',
    defaultDescription: 'Stöd varandra',
  },
];
