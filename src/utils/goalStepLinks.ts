/**
 * Maps a goal's daily step to the page that actually lets the user do it.
 *
 * Lives here rather than in WorldClassDashboard because it is a pure function
 * and a component file that also exports plain helpers breaks react-refresh —
 * eslint says so, and it is the same reason navItems was pulled out of Sidebar.
 *
 * The mood branch used to return "/", which is the public marketing and login
 * page. A signed-in user tapping the arrow on "Logga ditt humör idag" was shown
 * the logged-out sales screen while the header still displayed them as signed
 * in. Nothing was actually broken underneath; it merely looked like the session
 * had ended, which in a mental-health app is its own kind of harm.
 */
// Helper function för att mappa steg till direkta feature-länkar
export const getFeatureLinkForStep = (stepText: string, t: (key: string) => string): { route: string; label: string } | null => {
  const stepLower = stepText.toLowerCase();

  // Andningsövningar
  if (stepLower.includes('andnings') || stepLower.includes('andetag') || stepLower.includes('breathe')) {
    return { route: '/recommendations', label: t('dashboard.openBreathingExercise') };
  }

  // Journaling/Tacksamhet
  if (stepLower.includes('skriv') || stepLower.includes('tacksam') || stepLower.includes('journal')) {
    return { route: '/journal', label: t('dashboard.openJournal') };
  }

  // Meditation
  if (stepLower.includes('meditation') || stepLower.includes('mindfulness')) {
    return { route: '/recommendations', label: t('dashboard.openMeditation') };
  }

  // Sömn (om sleep tracking finns)
  if (stepLower.includes('sömn') || stepLower.includes('lägg dig') || stepLower.includes('sleep')) {
    return { route: '/recommendations', label: t('dashboard.seeSleepTips') };
  }

  // Humör/Mood logging
  if (stepLower.includes('humör') || stepLower.includes('mood') || stepLower.includes('logga')) {
    // Was '/', which is the public login page. The arrow on a mood goal sent a
    // signed-in user to the marketing screen instead of the mood logger.
    return { route: '/mood-basic', label: t('dashboard.openMoodLogger') };
  }

  // Promenad/Fysisk aktivitet
  if (stepLower.includes('promenad') || stepLower.includes('walk') || stepLower.includes('stretching') || stepLower.includes('vatten')) {
    return { route: '/recommendations', label: t('dashboard.seeRecommendations') };
  }

  return null;
};
