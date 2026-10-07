/**
 * The application's navigation items, in one place.
 *
 * These lived inside Sidebar.tsx, which is `hidden lg:flex`. Below 1024px the
 * sidebar is not rendered at all, so eight routes had no reachable entry point
 * on a phone: /analytics, /crisis, /feedback, /integrations, /mood/advanced,
 * /mood/forecast, /referral and /weekly-analysis. /crisis is what makes that a
 * defect rather than an inconvenience.
 *
 * Two renderers read these lists: the sidebar from lg, and the bottom bar's
 * "Utforska" sheet below it. A link added here shows up in both without anyone
 * remembering to do it twice, and MobileNavigation.test.tsx fails if the sheet
 * ever drops one.
 */
import React from 'react';
import {
  HomeIcon,
  FaceSmileIcon,
  ChatBubbleLeftRightIcon,
  SparklesIcon,
  HeartIcon,
  BookOpenIcon,
  ChartBarIcon,
  TrophyIcon,
  UserGroupIcon,
  LightBulbIcon,
  PresentationChartLineIcon,
  BeakerIcon,
  ArrowTrendingUpIcon,
  CalendarDaysIcon,
  ClipboardDocumentCheckIcon,
  StarIcon,
  ArrowPathRoundedSquareIcon,
  GiftIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  LifebuoyIcon,
} from '@heroicons/react/24/outline';
import {
  HomeIcon as HomeIconSolid,
  FaceSmileIcon as FaceSmileIconSolid,
  ChatBubbleLeftRightIcon as ChatBubbleLeftRightIconSolid,
  SparklesIcon as SparklesIconSolid,
  HeartIcon as HeartIconSolid,
  BookOpenIcon as BookOpenIconSolid,
  ChartBarIcon as ChartBarIconSolid,
  TrophyIcon as TrophyIconSolid,
  UserGroupIcon as UserGroupIconSolid,
  LightBulbIcon as LightBulbIconSolid,
  PresentationChartLineIcon as PresentationChartLineIconSolid,
  BeakerIcon as BeakerIconSolid,
  ArrowTrendingUpIcon as ArrowTrendingUpIconSolid,
  CalendarDaysIcon as CalendarDaysIconSolid,
  ClipboardDocumentCheckIcon as ClipboardDocumentCheckIconSolid,
  StarIcon as StarIconSolid,
  LifebuoyIcon as LifebuoyIconSolid,
} from '@heroicons/react/24/solid';

export interface NavItem {
  path: string;
  labelKey: string;
  labelDefault: string;
  icon: React.ElementType;
  iconActive: React.ElementType;
  premium?: boolean;
  /** Allow active highlighting when the current path is a child of this item (e.g. /mood/advanced/step-1). */
  allowNested?: boolean;
}

export interface SecondaryLink {
  path: string;
  labelKey: string;
  labelDefault: string;
  icon: React.ElementType;
}

/** Always-visible items (available on the free plan). */
export const FREE_NAV_ITEMS: NavItem[] = [
  { path: '/dashboard', labelKey: 'sidebar.home', labelDefault: 'Hem', icon: HomeIcon, iconActive: HomeIconSolid },
  { path: '/mood-basic', labelKey: 'sidebar.mood', labelDefault: 'Humör', icon: FaceSmileIcon, iconActive: FaceSmileIconSolid },
  { path: '/ai-chat', labelKey: 'sidebar.aiSupport', labelDefault: 'AI Stöd', icon: ChatBubbleLeftRightIcon, iconActive: ChatBubbleLeftRightIconSolid },
  { path: '/mood/assessment', labelKey: 'sidebar.clinicalAssessment', labelDefault: 'Klinisk bedömning', icon: ClipboardDocumentCheckIcon, iconActive: ClipboardDocumentCheckIconSolid },
  { path: '/daily-insights', labelKey: 'sidebar.dailyInsights', labelDefault: 'Dagliga insikter', icon: LightBulbIcon, iconActive: LightBulbIconSolid },
  // The crisis page (Självmordslinjen, BRIS, 1177, jourhavande medmänniska)
  // was a registered route that nothing in the UI linked to -- reachable only
  // by typing the URL. Free-tier and always last so it sits in a predictable
  // place regardless of plan.
  { path: '/crisis', labelKey: 'sidebar.crisis', labelDefault: 'Hjälp och stöd', icon: LifebuoyIcon, iconActive: LifebuoyIconSolid },
];

/** Premium items grouped separately — free users see a collapsed section instead of 10+ cluttered items. */
export const PREMIUM_NAV_ITEMS: NavItem[] = [
  { path: '/recommendations', labelKey: 'sidebar.premium.recommendations', labelDefault: 'Rekommendationer', icon: SparklesIcon, iconActive: SparklesIconSolid, premium: true },
  { path: '/wellness', labelKey: 'sidebar.premium.wellness', labelDefault: 'Välmående', icon: HeartIcon, iconActive: HeartIconSolid, premium: true },
  { path: '/journal', labelKey: 'sidebar.premium.journal', labelDefault: 'Dagbok', icon: BookOpenIcon, iconActive: BookOpenIconSolid, premium: true },
  { path: '/ai-stories', labelKey: 'sidebar.premium.aiStories', labelDefault: 'AI-berättelser', icon: StarIcon, iconActive: StarIconSolid, premium: true },
  { path: '/analytics', labelKey: 'sidebar.premium.moodAnalytics', labelDefault: 'Humöranalys', icon: PresentationChartLineIcon, iconActive: PresentationChartLineIconSolid, premium: true },
  { path: '/mood/advanced', labelKey: 'sidebar.premium.advancedMood', labelDefault: 'Avancerat humör', icon: BeakerIcon, iconActive: BeakerIconSolid, premium: true },
  { path: '/mood/forecast', labelKey: 'sidebar.premium.aiForecast', labelDefault: 'AI-prognos', icon: ArrowTrendingUpIcon, iconActive: ArrowTrendingUpIconSolid, premium: true },
  { path: '/weekly-analysis', labelKey: 'sidebar.premium.weeklyAnalysis', labelDefault: 'Veckoanalys', icon: CalendarDaysIcon, iconActive: CalendarDaysIconSolid, premium: true },
  { path: '/insights', labelKey: 'sidebar.premium.insights', labelDefault: 'Insikter', icon: ChartBarIcon, iconActive: ChartBarIconSolid, premium: true },
  { path: '/rewards', labelKey: 'sidebar.premium.rewards', labelDefault: 'Belöningar', icon: TrophyIcon, iconActive: TrophyIconSolid, premium: true },
  { path: '/social', labelKey: 'sidebar.premium.community', labelDefault: 'Gemenskap', icon: UserGroupIcon, iconActive: UserGroupIconSolid, premium: true },
];

/** Quick lookup: auto-expand the premium section when navigating to a premium route. */

/** Secondary utility links shown at the bottom of the sidebar. */
export const SECONDARY_LINKS: SecondaryLink[] = [
  { path: '/integrations', labelKey: 'sidebar.healthIntegrations', labelDefault: 'Hälsointegrationer', icon: ArrowPathRoundedSquareIcon },
  { path: '/referral', labelKey: 'sidebar.inviteFriends', labelDefault: 'Bjud in vänner', icon: GiftIcon },
  { path: '/feedback', labelKey: 'sidebar.giveFeedback', labelDefault: 'Ge feedback', icon: ChatBubbleOvalLeftEllipsisIcon },
];
