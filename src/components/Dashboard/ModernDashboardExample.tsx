/**
 * EXEMPEL: Hur man använder de nya Dashboard-komponenterna
 * 
 * Detta visar den moderna, strukturerade approach för dashboard-utveckling.
 * Använd detta som guide när du refaktorerar Dashboard.tsx
 */

import React from 'react'
import { colors, spacing, shadows, borderRadius } from '@/theme/tokens';
import { useTranslation } from 'react-i18next';
import { DashboardLayout, DashboardHeader, DashboardGrid, DashboardSection } from './Layout';
import { BaseWidget, StatCard, ActionCard } from './Widgets';

interface ModernDashboardExampleProps {
  userId: string;
  userName: string;
  hasLoggedToday: boolean;
  streak?: number;
}

const ModernDashboardExample: React.FC<ModernDashboardExampleProps> = ({
  userName,
  hasLoggedToday,
  streak = 0,
}) => {
  const { t } = useTranslation();

  // Exempel på stats data
  const stats = {
    totalMoods: 42,
    avgMood: 7.5,
    currentStreak: 5,
    trend: 'improving' as const,
  };

  return (
    <DashboardLayout>
      {/* Header Section */}
      <DashboardHeader
        userName={userName}
        title={t('dashboard.title')}
        subtitle={t('dashboard.welcome')}
        streak={streak}
        showReminder={!hasLoggedToday}
        reminderMessage={t('dashboard.moodReminder')}
      >
        {/* Widgets kan läggas direkt i header */}
      </DashboardHeader>

      {/* Stats Overview Section */}
      <DashboardSection 
        title="Din Översikt" 
        icon="📊"
        span={3}
        delay={0.1}
      >
        <DashboardGrid columns={{ mobile: 2, tablet: 3, desktop: spacing.xl }} gap="md">
          <StatCard
            label="Totala Humör"
            value={stats.totalMoods}
            icon="🎭"
            color="primary"
            delay={0.2}
          />
          <StatCard
            label="Genomsnitt Vecka"
            value={stats.avgMood}
            icon="📈"
            color="success"
            trend="up"
            trendValue="+0.5"
            delay={0.3}
          />
          <StatCard
            label="Streak"
            value={stats.currentStreak}
            icon="🔥"
            color="warning"
            delay={0.4}
          />
          <StatCard
            label="Trend"
            value={stats.trend === 'improving' ? '↗️' : '↘️'}
            icon="📊"
            color={stats.trend === 'improving' ? 'success' : 'danger'}
            delay={0.5}
          />
        </DashboardGrid>
      </DashboardSection>

      {/* Quick Actions Section */}
      <DashboardSection 
        title="Snabbåtgärder" 
        icon="⚡"
        subtitle="Starta din dag rätt"
        span={3}
        delay={0.2}
      >
        <DashboardGrid columns={{ mobile: 1, tablet: 2, desktop: spacing.xl }} gap="md">
          <ActionCard
            title="Logga Humör"
            description="Spåra ditt känslotillstånd"
            icon="🎭"
            onClick={() => console.log('Open mood logger')}
            variant="primary"
            buttonText="Starta"
            delay={0.3}
          />
          <ActionCard
            title="Spela In Minne"
            description="Dokumentera ett minne"
            icon="🎙️"
            onClick={() => console.log('Open memory recorder')}
            variant="secondary"
            buttonText="Spela In"
            delay={0.4}
          />
          <ActionCard
            title="AI Terapeut"
            description="Chatta med vår AI"
            icon="🤖"
            onClick={() => console.log('Open chatbot')}
            variant="gradient"
            buttonText="Öppna Chat"
            delay={0.5}
          />
          <ActionCard
            title="Lugn Musik"
            description="Avslappnande ljud"
            icon="🎵"
            onClick={() => console.log('Open relaxing sounds')}
            variant="success"
            buttonText="Lyssna"
            delay={0.6}
          />
        </DashboardGrid>
      </DashboardSection>

      {/* Widgets Section */}
      <DashboardGrid columns={{ mobile: 1, tablet: 2, desktop: spacing.lg }} gap="lg">
        {/* Analytics Widget Example */}
        <BaseWidget
          title="Humör Analys"
          subtitle="Senaste 7 dagarna"
          icon="📊"
          size="md"
          variant="primary"
          delay={0.3}
        >
          <p className="text-center text-slate-600 dark:text-slate-400">
            Din genomsnittliga humörnivå har ökat med 12% denna vecka! 🎉
          </p>
        </BaseWidget>

        {/* Referral Widget Example */}
        <BaseWidget
          title="Bjud In Vänner"
          subtitle="Tjäna belöningar"
          icon="🎁"
          size="md"
          variant="secondary"
          delay={0.4}
        >
          <div className="text-center">
            <div className="text-2xl font-bold text-primary-600 mb-2">3</div>
            <p className="text-sm text-slate-600 dark:text-slate-400">vänner inbjudna</p>
          </div>
        </BaseWidget>

        {/* Activity Widget Example */}
        <BaseWidget
          title="Senaste Aktivitet"
          icon="📝"
          size="md"
          delay={0.5}
        >
          <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
            <li>✅ Humör loggat idag</li>
            <li>📝 Minne inspelat igår</li>
            <li>🎯 Mål uppnått denna vecka</li>
          </ul>
        </BaseWidget>
      </DashboardGrid>

      {/* Loading State Example */}
      <DashboardSection title="Laddar Data..." span={2} delay={0.4}>
        <BaseWidget loading={true}>
          {/* Content hidden during loading */}
          <p>This will show when loaded</p>
        </BaseWidget>
      </DashboardSection>

      {/* Error State Example */}
      <DashboardSection title="Fel Demo" span={1} delay={0.5}>
        <BaseWidget error="Kunde inte ladda data. Försök igen senare.">
          <p>This won't show because error is set</p>
        </BaseWidget>
      </DashboardSection>
    </DashboardLayout>
  );
};

export default ModernDashboardExample;

/**
 * MIGRATION GUIDE FÖR DASHBOARD.TSX:
 * 
 * 1. ERSÄTT:
 *    <motion.div className="min-h-screen bg-gradient...">
 *    MED:
 *    <DashboardLayout>
 * 
 * 2. ERSÄTT:
 *    <motion.header className="text-center mb-12">
 *      <h1>...
 *    MED:
 *    <DashboardHeader title="..." subtitle="..." userName={name} />
 * 
 * 3. ERSÄTT:
 *    <motion.section className="grid grid-cols-1 sm:grid-cols-2...">
 *    MED:
 *    <DashboardSection title="...">
 *      <DashboardGrid columns={{mobile: 1, tablet: 2, desktop: spacing.xl}}>
 * 
 * 4. ERSÄTT Action Buttons:
 *    <motion.div className="bg-gradient-to-br...">
 *      <button onClick={...}>
 *    MED:
 *    <ActionCard title="..." icon="..." onClick={...} />
 * 
 * 5. ERSÄTT Stats Display:
 *    <div className="text-center">
 *      <Typography variant="h6">{value}</Typography>
 *    MED:
 *    <StatCard label="..." value={...} icon="..." />
 * 
 * 6. WRAP Existing Widgets:
 *    <ReferralWidget userId={...} />
 *    MED:
 *    <BaseWidget title="Referral Program" icon="🎁">
 *      <ReferralWidget userId={...} />
 *    </BaseWidget>
 * 
 * FÖRDELAR:
 * - 50% mindre kod
 * - Konsekvent styling
 * - Återanvändbarhet
 * - Lättare underhåll
 * - Bättre responsivitet
 * - Inbyggd loading/error states
 * - Professionell animations
 */
