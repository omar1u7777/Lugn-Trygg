import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Dialog, DialogHeader, DialogTitle, DialogDescription, DialogContent, DialogFooter, Input, Snackbar } from './ui/tailwind';
import { useTranslation } from 'react-i18next';
import PrivacySettings from './PrivacySettings';
import DeleteAccountFlow from './ProfileHub/DeleteAccountFlow';
import PremiumUpsell from './ProfileHub/PremiumUpsell';
import PasswordStrengthIndicator from './ui/PasswordStrengthIndicator';
import ScrollableTabs from './ui/ScrollableTabs';
import { ThemeToggle } from './ui/ThemeToggle';
import LanguageSwitcher from './LanguageSwitcher';
import OptimizedImage from './ui/OptimizedImage';
import useAuth from '../hooks/useAuth';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useDebouncedSave } from '../hooks/useDebouncedSave';
import { changeEmail, changePassword, setup2FA, verify2FASetup, exportUserData, deleteAccount } from '../api/api';
import { getUserProfile, getUserStats, updateUserPreferences } from '../api/users';
import { getApiErrorMessage } from '../api/errorUtils';
import { logger } from '../utils/logger';
import {
  BellIcon,
  ShieldCheckIcon,
  UserIcon,
  Cog6ToothIcon,
  ChatBubbleLeftIcon,
  HeartIcon,
  SparklesIcon,
  StarIcon,
  CreditCardIcon,
  GiftIcon,
  ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div
    role="tabpanel"
    hidden={value !== index}
    id={`profile-tabpanel-${index}`}
    aria-labelledby={`profile-tab-${index}`}
  >
    {value === index && <div>{children}</div>}
  </div>
);

/**
 * Tab order, as names. The indices are an implementation detail of the tab
 * strip; the names are what appears in the URL and therefore what people can
 * bookmark, so they are the stable half of this pair.
 */
const TAB_NAMES = ['account', 'privacy', 'notifications', 'appearance'] as const;
const TAB_INDEX_BY_NAME: Record<string, number> = Object.fromEntries(
  TAB_NAMES.map((name, index) => [name, index])
);

interface ProfileStats {
  totalMoods: number;
  totalConversations: number;
  totalMemories: number;
  accountAge: number;
}

const ProfileHub: React.FC = () => {
  const { t } = useTranslation();
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const { plan, isPremium, isTrial, usage, getRemainingMoodLogs, getRemainingMessages } = useSubscription();
  /*
   * The active tab lives in the URL.
   *
   * It was useState(0), and changing the theme sent the user back to
   * "Kontoinställningar" from whichever tab they had chosen — reproduced
   * several times in QA. I did not find the remount that causes it, and that
   * is rather the point: local state resets for reasons that are not visible
   * from here, while a query parameter survives any of them.
   *
   * It also makes the tabs linkable, which they were not.
   */
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = TAB_INDEX_BY_NAME[searchParams.get('tab') ?? ''] ?? 0;
  const setActiveTab = useCallback((index: number) => {
    const next = new URLSearchParams(searchParams);
    const name = TAB_NAMES[index];
    if (name) next.set('tab', name);
    // replace, not push: flipping tabs should not fill the back button.
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  // Snackbar state (moved up to stabilize callbacks for useDebouncedSave)
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    variant: 'info' as 'success' | 'error' | 'warning' | 'info'
  });

  const showSnackbar = useCallback((message: string, variant: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setSnackbar({ open: true, message, variant });
  }, []);

  // Stabilized callbacks for debounced save (prevents infinite re-fetch loop)
  const handleSaveSettings = useCallback(async (settings: Record<string, unknown>) => {
    await updateUserPreferences(settings);
    showSnackbar(t('profileHub.settingsSaved', 'Inställningar sparade'), 'success');
  }, [showSnackbar, t]);

  const handleSaveError = useCallback((error: Error) => {
    showSnackbar(getApiErrorMessage(error, 'Kunde inte spara inställningar'), 'error');
  }, [showSnackbar]);

  // DEBOUNCED: Use debounced save for settings
  const settingsManager = useDebouncedSave(
    {
      emailNotifications: true,
      pushNotifications: false,
      dataSharing: false,
      publicProfile: false,
    },
    {
      onSave: handleSaveSettings,
      delay: 1000,
      onError: handleSaveError,
    }
  );
  const { data: settings, updateData: updateSettings, isSaving: isSavingSettings, hasUnsavedChanges, cancelSave, setBaseline: setSettingsBaseline } = settingsManager;
  // True when the saved preferences could not be fetched. The toggles then
  // show the hardcoded defaults rather than the user's real settings, so
  // writing them back would silently overwrite what they actually chose.
  const [settingsLoadFailed, setSettingsLoadFailed] = useState(false);
  const [profileStats, setProfileStats] = useState<ProfileStats>({
    totalMoods: 0,
    totalConversations: 0,
    totalMemories: 0,
    accountAge: 0,
  });
  const [loading, setLoading] = useState(true);

  // Modal states
  const [changeEmailModal, setChangeEmailModal] = useState(false);
  const [changePasswordModal, setChangePasswordModal] = useState(false);
  const [enable2FAModal, setEnable2FAModal] = useState(false);
  const [deleteAccountModal, setDeleteAccountModal] = useState(false);

  // Form states
  const [changeEmailForm, setChangeEmailForm] = useState({
    newEmail: '',
    password: ''
  });
  const [changePasswordForm, setChangePasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [twoFactorForm, setTwoFactorForm] = useState({
    code: ''
  });

  // Loading and error states
  const [modalLoading, setModalLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // 2FA setup data
  const [twoFactorSetup, setTwoFactorSetup] = useState<{
    qrCode?: string;
    secret?: string;
    provisioningUri?: string;
  } | null>(null);

  useEffect(() => {
    const fetchProfileData = async () => {
      logger.debug('👤 PROFILE HUB - Component mounted, loading data', { userId: user?.user_id });
      if (!user?.user_id) {
        logger.warn('⚠️ PROFILE HUB - No user ID');
        setLoading(false);
        return;
      }

      try {
        logger.debug('📊 PROFILE HUB - Fetching aggregated stats and profile...');
        // OPTIMIZED: Use aggregated stats endpoint instead of fetching all data
        const [statsResult, profileResult] = await Promise.allSettled([
          getUserStats(),
          getUserProfile(),
        ]);

        // Promise.allSettled never rejects, so the catch below cannot see a
        // failed fetch. Without this the profile call could fail, the saved
        // preferences would never load, and the toggles would silently render
        // the hardcoded defaults above (emailNotifications: true) as if they
        // were the user's own settings. Touching any toggle then triggers the
        // debounced save, writing all four defaults back over what they
        // actually chose -- e.g. re-enabling email for someone who opted out.
        const profileFailed = profileResult.status === 'rejected';
        setSettingsLoadFailed(profileFailed);
        if (profileFailed) {
          logger.error('❌ PROFILE HUB - Could not load saved preferences', profileResult.reason);
          showSnackbar(
            t('profileHub.settingsLoadFailed', 'Kunde inte hämta dina sparade inställningar. Ladda om sidan innan du ändrar något.'),
            'error'
          );
        }
        if (statsResult.status === 'rejected') {
          logger.error('❌ PROFILE HUB - Could not load stats', statsResult.reason);
        }

        // Load saved settings from profile
        const profile = profileResult.status === 'fulfilled' ? profileResult.value : null;
        if (profile?.preferences) {
          const loadedSettings = {
            emailNotifications: true,
            pushNotifications: false,
            dataSharing: false,
            publicProfile: false,
            ...(typeof profile.preferences === 'object' ? profile.preferences : {}),
          };
          /*
             Adopting server state, not editing. updateSettings moves the
             working copy but leaves the hook's comparison point on this
             component's hardcoded defaults, so the tab announced "Osparade
             ändringar" the instant the fetch resolved — before the user had
             touched a control, and with no Save button to act on it.
          */
          setSettingsBaseline(loadedSettings);
        }

        // Use aggregated stats from backend
        const stats = statsResult.status === 'fulfilled' ? statsResult.value : null;
        
        // Fallback: Calculate account age from user creation date if not provided
        let accountAge = stats?.accountAge || 0;
        if (!accountAge && user.createdAt) {
          const created = typeof user.createdAt === 'string' ? new Date(user.createdAt) : user.createdAt;
          if (!isNaN(created.getTime())) {
            accountAge = Math.max(1, Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24)));
          }
        }

        setProfileStats({
          totalMoods: stats?.totalMoods || 0,
          totalConversations: stats?.totalConversations || 0,
          totalMemories: stats?.totalMemories || 0,
          accountAge,
        });
        logger.debug('✅ PROFILE HUB - Stats loaded from backend', {
          totalMoods: stats?.totalMoods || 0,
          accountAge,
        });
      } catch (error: unknown) {
        logger.error('❌ PROFILE HUB - Failed to fetch profile data:', error);
        const errorMessage = error instanceof Error ? error.message : 'Kunde inte ladda profildata';
        showSnackbar(errorMessage, 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [updateSettings, user?.createdAt, user?.user_id, cancelSave, setSettingsBaseline, showSnackbar, t]);

  const handleSettingChange = (setting: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    // Refuse to save when the stored preferences never loaded — the values in
    // state are defaults, not the user's, and persisting them would overwrite
    // real choices with guesses.
    if (settingsLoadFailed) {
      showSnackbar(
        t('profileHub.settingsLoadFailed', 'Kunde inte hämta dina sparade inställningar. Ladda om sidan innan du ändrar något.'),
        'error'
      );
      return;
    }
    const checked = event.target.checked;
    // DEBOUNCED: Update settings with automatic save
    updateSettings(prev => ({ ...prev, [setting]: checked }));
  };

  // Modal handlers

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const validateEmail = (email: string): string | null => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) return 'E-postadress krävs';
    if (!emailRegex.test(email)) return 'Ogiltig e-postadress';
    return null;
  };

  const handleChangeEmail = async () => {
    setFormErrors({});
    const { newEmail, password } = changeEmailForm;

    const emailError = validateEmail(newEmail);
    if (emailError) {
      setFormErrors({ newEmail: emailError });
      return;
    }

    if (!password) {
      setFormErrors({ password: 'Nuvarande lösenord krävs' });
      return;
    }

    setModalLoading(true);
    try {
      await changeEmail(newEmail, password);
      showSnackbar('E-postadressen uppdaterad!', 'success');
      setChangeEmailModal(false);
      setChangeEmailForm({ newEmail: '', password: '' });
      // Update user in context instead of full page reload
      if (user) {
        setUser({ ...user, email: newEmail });
      }
    } catch (error: unknown) {
      showSnackbar(getApiErrorMessage(error, 'Kunde inte ändra e-post'), 'error');
    } finally {
      setModalLoading(false);
    }
  };

  const validatePasswordFull = (password: string): string | null => {
    if (!password) return 'Lösenord krävs';
    if (password.length < 8) return 'Lösenord måste vara minst 8 tecken';
    if (!/[A-Z]/.test(password)) return 'Lösenord måste innehålla stor bokstav';
    if (!/[a-z]/.test(password)) return 'Lösenord måste innehålla liten bokstav';
    if (!/\d/.test(password)) return 'Lösenord måste innehålla siffra';
    if (!/[!@#$%^&*()_+\-=\[\]{};\':"\\|,.<>\/?]/.test(password)) return 'Lösenord måste innehålla specialtecken';
    return null;
  };

  const handleChangePassword = async () => {
    setFormErrors({});
    const { currentPassword, newPassword, confirmPassword } = changePasswordForm;

    if (!currentPassword) {
      setFormErrors({ currentPassword: 'Nuvarande lösenord krävs' });
      return;
    }

    // Full validation on submit
    const passwordError = validatePasswordFull(newPassword);
    if (passwordError) {
      setFormErrors({ newPassword: passwordError });
      return;
    }

    if (newPassword !== confirmPassword) {
      setFormErrors({ confirmPassword: 'Lösenorden matchar inte' });
      return;
    }

    setModalLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      showSnackbar('Lösenord uppdaterat!', 'success');
      setChangePasswordModal(false);
      setChangePasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: unknown) {
      showSnackbar(getApiErrorMessage(error, 'Kunde inte ändra lösenord'), 'error');
    } finally {
      setModalLoading(false);
    }
  };

  const handleEnable2FA = async () => {
    setModalLoading(true);
    try {
      const setupData = await setup2FA();
      setTwoFactorSetup({
        qrCode: setupData.qrCode || setupData.qr_code,
        secret: setupData.secret,
        provisioningUri: setupData.provisioningUri || setupData.provisioning_uri
      });
      setEnable2FAModal(true);
    } catch (error: unknown) {
      showSnackbar(getApiErrorMessage(error, 'Kunde inte aktivera 2FA'), 'error');
    } finally {
      setModalLoading(false);
    }
  };

  const handleVerify2FA = async () => {
    setFormErrors({});
    const { code } = twoFactorForm;

    if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
      setFormErrors({ code: 'Ange en giltig 6-siffrig kod' });
      return;
    }

    setModalLoading(true);
    try {
      await verify2FASetup(code);
      showSnackbar('2FA aktiverat!', 'success');
      setEnable2FAModal(false);
      setTwoFactorForm({ code: '' });
      setTwoFactorSetup(null);
      if (user) {
        setUser({ ...user, twoFactorEnabled: true });
      }
    } catch (error: unknown) {
      showSnackbar(getApiErrorMessage(error, 'Kunde inte verifiera 2FA'), 'error');
    } finally {
      setModalLoading(false);
    }
  };

  const handleExportData = async () => {
    setModalLoading(true);
    try {
      await exportUserData();
      showSnackbar('Din data har exporterats!', 'success');
    } catch (error: unknown) {
      showSnackbar(getApiErrorMessage(error, 'Kunde inte exportera data'), 'error');
    } finally {
      setModalLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
      {/* Identity Card Hero */}
      <div className="mb-8">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-linear-to-br from-slate-800 to-slate-900 dark:from-indigo-900 dark:to-slate-900 text-white shadow-2xl p-8 sm:p-10">
          {/* Background Decor */}
          <div className="absolute top-0 right-0 p-40 bg-white/5 rounded-full blur-3xl transform translate-x-1/3 -translate-y-1/3 pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-8">
            {/* Avatar Section */}
            <div className="relative">
              <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full p-1 bg-linear-to-br from-indigo-400 to-purple-400 shadow-xl">
                <div className="w-full h-full rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-5xl sm:text-6xl font-bold text-transparent bg-clip-text bg-linear-to-br from-indigo-500 to-purple-600">
                  {user?.email?.charAt(0).toUpperCase() || '👤'}
                </div>
              </div>
              {isPremium && (
                <div className="absolute -bottom-2 -right-2 bg-linear-to-r from-amber-400 to-amber-600 text-white px-4 py-1.5 rounded-full text-sm font-bold shadow-lg border-2 border-slate-900 flex items-center gap-1">
                  <StarIcon className="w-4 h-4" />
                  PREMIUM
                </div>
              )}
            </div>

            {/* Info Section */}
            <div className="text-center md:text-left flex-1">
              {/*
                break-words, because an e-mail address contains nothing the
                browser is willing to break on. At text-5xl the heading ran to
                the edge of the viewport on the tested width and would have
                gone past it for anything longer. title carries the full value
                for the truncating case.
              */}
              <h1
                className="text-3xl sm:text-4xl md:text-5xl font-bold mb-2 tracking-tight wrap-anywhere wrap-break-word"
                title={user?.email || undefined}
              >
                {user?.email || t('profileHub.guest', 'Gäst')}
              </h1>
              <p className="text-indigo-200 text-lg mb-6 max-w-lg mx-auto md:mx-0">
                {user?.email ? t('profileHub.manageJourney', 'Hantera din personliga resa, inställningar och säkerhet.') : t('profileHub.loginToSave', 'Logga in för att spara din data.')}
              </p>

              <div className="flex flex-wrap justify-center md:justify-start gap-3">
                <div className="px-4 py-2 bg-white/10 backdrop-blur-md rounded-xl border border-white/10 text-sm font-medium flex items-center gap-2">
                  <UserIcon className="w-4 h-4 text-indigo-300" />
                  {/*
                    accountAge starts at 0, so this rendered "Medlem i 0 dagar"
                    before the fetch resolved — a wrong fact rather than an
                    absent one, and one that would have stuck permanently if the
                    call failed silently.
                  */}
                  {loading ? (
                    <span
                      className="inline-block h-4 w-28 rounded-sm bg-white/20 animate-pulse"
                      aria-label={t('common.loading')}
                    />
                  ) : (
                    t('profileHub.memberForDays', { count: profileStats.accountAge })
                  )}
                </div>
                {!isPremium && (
                  <Button
                    variant="primary"
                    size="small"
                    onClick={() => navigate('/upgrade')}
                    className="bg-amber-500 hover:bg-amber-600 text-white border-none shadow-lg shadow-amber-500/20"
                  >
                    {t('profileHub.upgradeNow', 'Uppgradera nu')}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats Bento Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
        {[
          { label: t('profileHub.moodLogs', 'Humörloggar'), value: profileStats.totalMoods, icon: HeartIcon, color: 'text-pink-500', bg: 'bg-pink-50 dark:bg-pink-900/20' },
          { label: t('profileHub.aiChats', 'AI-samtal'), value: profileStats.totalConversations, icon: ChatBubbleLeftIcon, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
          { label: t('profileHub.memories', 'Minnen'), value: profileStats.totalMemories, icon: SparklesIcon, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20' },
          { label: t('profileHub.daysActive', 'Dagar aktiv'), value: `${profileStats.accountAge}d`, icon: UserIcon, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20' }
        ].map((stat) => (
          <div key={stat.label} className="group bg-white dark:bg-slate-800 rounded-3xl p-6 border border-gray-100 dark:border-gray-700/50 shadow-xs hover:shadow-xl hover:scale-[1.02] transition-all duration-300">
            <div className={`w-12 h-12 rounded-2xl ${stat.bg} ${stat.color} flex items-center justify-center mb-4 transition-transform group-hover:rotate-6`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
              {loading ? <span className="inline-block w-8 h-8 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-sm" /> : stat.value}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* Subscription Status Card - REAL IMPLEMENTATION */}
      <Card className={`mb-6 sm:mb-8 overflow-hidden ${isPremium ? 'bg-linear-to-r from-accent-400 to-accent-500' : isTrial ? 'bg-linear-to-r from-primary-500 to-primary-600' : 'bg-linear-to-r from-primary-50 to-primary-100 dark:from-primary-800 dark:to-primary-700'}`}>
        <div className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center ${isPremium ? 'bg-white/20' : isTrial ? 'bg-white/20' : 'bg-primary-200 dark:bg-primary-900/40'}`}>
                {isPremium ? (
                  <StarIcon className="w-8 h-8 text-white" />
                ) : isTrial ? (
                  <GiftIcon className="w-8 h-8 text-white" />
                ) : (
                  <CreditCardIcon className="w-8 h-8 text-primary-600 dark:text-primary-300" />
                )}
              </div>
              <div>
                <h3 className={`text-xl sm:text-2xl font-bold ${isPremium ? 'text-white' : isTrial ? 'text-white' : 'text-primary-800 dark:text-primary-100'}`}>
                  {isPremium ? `⭐ ${t('profileHub.premiumMember')}` : isTrial ? `🎁 ${t('profileHub.trial')}` : `🆓 ${t('profileHub.freePlan')}`}
                </h3>
                <p className={`text-sm ${isPremium ? 'text-white/80' : isTrial ? 'text-white/80' : 'text-primary-700 dark:text-primary-200'}`}>
                  {isPremium
                    ? t('profileHub.unlimitedAccess')
                    : isTrial
                      ? t('profileHub.unlimitedAccess')
                      : `${getRemainingMoodLogs()} humörloggningar kvar idag • ${getRemainingMessages()} chattmeddelanden kvar`
                  }
                </p>
              </div>
            </div>

            {!isPremium && !isTrial && (
              <Button
                variant="primary"
                className="bg-linear-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold"
                onClick={() => navigate('/upgrade')}
              >
                {t('profileHub.upgradeToPremium')}
              </Button>
            )}
          </div>

          {/* Usage bars for free users (not trial/premium) */}
          {!isPremium && !isTrial && (
            <div className="mt-4 pt-4 border-t border-primary-200 dark:border-primary-700/50">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-primary-700 dark:text-primary-200">{t('profileHub.moodLogs')}</span>
                    <span className="font-medium text-primary-800 dark:text-primary-100">{usage.moodLogs}/{plan.limits.moodLogsPerDay}</span>
                  </div>
                  <div className="w-full bg-primary-200/60 dark:bg-primary-900/40 rounded-full h-2">
                    <div
                      className="bg-primary-500 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min((usage.moodLogs / plan.limits.moodLogsPerDay) * 100, 100)}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-primary-700 dark:text-primary-200">{t('profileHub.chatMessages')}</span>
                    <span className="font-medium text-primary-800 dark:text-primary-100">{usage.chatMessages}/{plan.limits.chatMessagesPerDay}</span>
                  </div>
                  <div className="w-full bg-primary-200/60 dark:bg-primary-900/40 rounded-full h-2">
                    <div
                      className="bg-secondary-500 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min((usage.chatMessages / plan.limits.chatMessagesPerDay) * 100, 100)}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-primary-700 dark:text-primary-200">{t('profileHub.history')}</span>
                    <span className="font-medium text-primary-800 dark:text-primary-100">{plan.limits.historyDays === -1 ? '∞' : `${plan.limits.historyDays} dagar`}</span>
                  </div>
                  <div className="w-full bg-primary-200/60 dark:bg-primary-900/40 rounded-full h-2">
                    <div className="bg-amber-500 h-2 rounded-full transition-all" style={{ width: '100%' }} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Contextual Premium Upsell */}
      {!isPremium && !isTrial && (
        <PremiumUpsell
          usage={usage}
          stats={profileStats}
          className="mb-6 sm:mb-8"
        />
      )}

      {/* Tabs for different profile sections */}
      <Card className="world-class-dashboard-card">
        <div className="border-b border-gray-200 dark:border-gray-700 relative">
          <ScrollableTabs
            tabs={[
              { icon: <UserIcon className="w-5 h-5" />, label: t('profileHub.tabAccount'), index: 0 },
              { icon: <ShieldCheckIcon className="w-5 h-5" />, label: t('profileHub.tabPrivacy'), index: 1 },
              { icon: <BellIcon className="w-5 h-5" />, label: t('profileHub.tabNotifications'), index: 2 },
              { icon: <Cog6ToothIcon className="w-5 h-5" />, label: t('profileHub.tabAppearance'), index: 3 },
            ]}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            ariaLabel="Profile sections"
          />
        </div>

        <div className="p-4 sm:p-6">
          {/* Account Settings Tab */}
          <TabPanel value={activeTab} index={0}>
            <div className="space-y-4 sm:space-y-6">
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6">
                {t('profileHub.accountInfo')}
              </h3>
              <div className="space-y-4">
                <Card className="border border-gray-200 dark:border-gray-700">
                  <div className="p-4 sm:p-6">
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1 sm:mb-2">
                      {t('profileHub.emailAddress')}
                    </p>
                    <p className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">
                      {user?.email || t('profileHub.notLoggedIn')}
                    </p>
                    <Button
                      variant="outline"
                      size="small"
                      onClick={() => setChangeEmailModal(true)}
                    >
                      {t('profileHub.changeEmail')}
                    </Button>
                  </div>
                </Card>

                <Card className="border border-gray-200 dark:border-gray-700">
                  <div className="p-4 sm:p-6">
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1 sm:mb-2">
                      {t('profileHub.password')}
                    </p>
                    <p className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">
                      ••••••••••
                    </p>
                    <Button
                      variant="outline"
                      size="small"
                      onClick={() => setChangePasswordModal(true)}
                    >
                      {t('profileHub.changePassword')}
                    </Button>
                  </div>
                </Card>

                <Card className="border border-gray-200 dark:border-gray-700">
                  <div className="p-4 sm:p-6">
                    <h4 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-2 sm:mb-3">
                      🔐 {t('profileHub.twoFactor')}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      {t('profileHub.twoFactorDesc')}
                    </p>
                    <Button
                      variant="primary"
                      className="bg-warning-600 hover:bg-warning-700"
                      onClick={handleEnable2FA}
                      disabled={modalLoading || user?.twoFactorEnabled}
                    >
                      {user?.twoFactorEnabled
                        ? t('profileHub.2faEnabled', '2FA aktiverat')
                        : modalLoading
                          ? t('profileHub.configuring')
                          : t('profileHub.enable2FA')}
                    </Button>
                  </div>
                </Card>
              </div>
            </div>
          </TabPanel>

          {/* Privacy Tab */}
          <TabPanel value={activeTab} index={1}>
            {user?.user_id ? (
              <PrivacySettings userId={user.user_id} />
            ) : (
              <div className="text-center py-8 sm:py-12">
                <p className="text-base sm:text-lg text-gray-600 dark:text-gray-300">
                  {t('profileHub.loginForPrivacy')}
                </p>
              </div>
            )}
          </TabPanel>

          {/* Notifications Tab */}
          <TabPanel value={activeTab} index={2}>
            <div className="space-y-4 sm:space-y-6">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                  {t('profileHub.notificationSettings')}
                </h3>
                {hasUnsavedChanges && (
                  <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                    {isSavingSettings ? (
                      <>
                        <div className="w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                        Sparar...
                      </>
                    ) : (
                      <>
                        <div className="w-2 h-2 bg-amber-600 rounded-full" />
                        Osparade ändringar
                      </>
                    )}
                  </div>
                )}
              </div>
              <div className="space-y-4">
                <Card className="border border-gray-200 dark:border-gray-700">
                  <label className="flex items-center justify-between p-4 sm:p-6 cursor-pointer">
                    <div className="flex-1">
                      <p className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                        {t('profileHub.emailNotifications')}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {t('profileHub.emailNotificationsDesc')}
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.emailNotifications}
                      onChange={handleSettingChange('emailNotifications')}
                      className="w-12 h-6 ml-4 accent-primary-600 cursor-pointer"
                    />
                  </label>
                </Card>

                <Card className="border border-gray-200 dark:border-gray-700">
                  <label className="flex items-center justify-between p-4 sm:p-6 cursor-pointer">
                    <div className="flex-1">
                      <p className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                        {t('profileHub.pushNotifications')}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {t('profileHub.pushNotificationsDesc')}
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.pushNotifications}
                      onChange={handleSettingChange('pushNotifications')}
                      className="w-12 h-6 ml-4 accent-primary-600 cursor-pointer"
                    />
                  </label>
                </Card>

                <div className="pt-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {t('profileHub.enableBrowserNotificationsQ')}
                  </p>
                  <Button
                    variant="primary"
                    onClick={() => {
                      if ('Notification' in window && Notification.permission === 'default') {
                        Notification.requestPermission();
                      }
                    }}
                    className="w-full sm:w-auto"
                  >
                    {t('profileHub.enableBrowserNotifications')}
                  </Button>
                </div>
              </div>
            </div>
          </TabPanel>

          {/* Appearance Tab */}
          <TabPanel value={activeTab} index={3}>
            <div className="space-y-4 sm:space-y-6">
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6">
                {t('profileHub.appearanceSettings')}
              </h3>
              <div className="space-y-4">
                <Card className="border border-gray-200 dark:border-gray-700">
                  <div className="p-4 sm:p-6">
                    <h4 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      {t('profileHub.themeMode')}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      {t('profileHub.themeModeDesc')}
                    </p>
                    <ThemeToggle />
                  </div>
                </Card>

                <Card className="border border-gray-200 dark:border-gray-700">
                  <div className="p-4 sm:p-6">
                    <h4 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      {t('profileHub.language')}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      {t('profileHub.languageDesc')}
                    </p>
                    <LanguageSwitcher />
                  </div>
                </Card>
              </div>
            </div>
          </TabPanel>
        </div>
      </Card>

      {/* Account Actions */}
      <Card className="border border-gray-200 dark:border-gray-700">
        <div className="p-4 sm:p-6 md:p-8">
          <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6">
            {t('profileHub.accountActions')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              variant="outline"
              className="w-full min-h-[44px] flex items-center justify-center gap-2"
              onClick={handleExportData}
              disabled={modalLoading}
            >
              <ShieldCheckIcon className="w-5 h-5" aria-hidden="true" />
              <span>{modalLoading ? t('profileHub.exporting') : t('profileHub.exportData')}</span>
            </Button>
            <Button
              variant="outline"
              className="w-full min-h-[44px] text-error-600 border-error-600 hover:bg-error-50 dark:hover:bg-error-900/20"
              onClick={() => setDeleteAccountModal(true)}
            >
              {t('profileHub.deleteAccount')}
            </Button>
            {/* Below lg the "Profil" tab in the bottom bar is the account entry
                (there is no account menu in the header there), so signing out
                has to be reachable from this page. From lg the header's account
                menu has it, and showing it twice is what the audit flagged. */}
            <Button
              variant="outline"
              className="lg:hidden w-full min-h-[44px] flex items-center justify-center gap-2 md:col-span-2"
              onClick={() => {
                if (window.confirm(t('navigation.confirmLogout'))) {
                  logout();
                }
              }}
            >
              <ArrowRightOnRectangleIcon className="w-5 h-5" aria-hidden="true" />
              <span>{t('navigation.logout')}</span>
            </Button>
          </div>
        </div>
      </Card>

      {/* Change Email Modal */}
      <Dialog open={changeEmailModal} onClose={() => setChangeEmailModal(false)}>
        <DialogHeader onClose={() => setChangeEmailModal(false)}>
          <DialogTitle>{t('profileHub.changeEmailTitle')}</DialogTitle>
          <DialogDescription>{t('profileHub.changeEmailDesc')}</DialogDescription>
        </DialogHeader>
        <DialogContent>
          <div className="space-y-4">
            <Input
              label={t('profileHub.newEmail')}
              type="email"
              value={changeEmailForm.newEmail}
              onChange={(e) => setChangeEmailForm({ ...changeEmailForm, newEmail: e.target.value })}
              error={formErrors.newEmail}
              required
            />
            <Input
              label={t('profileHub.currentPassword')}
              type="password"
              value={changeEmailForm.password}
              onChange={(e) => setChangeEmailForm({ ...changeEmailForm, password: e.target.value })}
              error={formErrors.password}
              required
            />
          </div>
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={() => setChangeEmailModal(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={handleChangeEmail}
            disabled={modalLoading}
          >
            {modalLoading ? t('profileHub.changing') : t('profileHub.changeEmail')}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Change Password Modal */}
      <Dialog open={changePasswordModal} onClose={() => setChangePasswordModal(false)}>
        <DialogHeader onClose={() => setChangePasswordModal(false)}>
          <DialogTitle>{t('profileHub.changePasswordTitle')}</DialogTitle>
          <DialogDescription>{t('profileHub.changePasswordDesc')}</DialogDescription>
        </DialogHeader>
        <DialogContent>
          <div className="space-y-4">
            <Input
              label={t('profileHub.currentPassword')}
              type="password"
              value={changePasswordForm.currentPassword}
              onChange={(e) => setChangePasswordForm({ ...changePasswordForm, currentPassword: e.target.value })}
              error={formErrors.currentPassword}
              required
            />
            <Input
              label={t('profileHub.newPassword')}
              type="password"
              value={changePasswordForm.newPassword}
              onChange={(e) => setChangePasswordForm({ ...changePasswordForm, newPassword: e.target.value })}
              error={formErrors.newPassword}
              helperText={t('registerForm.passwordHelp')}
              required
            />
            
            {/* Password Strength Indicator */}
            {changePasswordForm.newPassword && (
              <div className="mt-2">
                <PasswordStrengthIndicator 
                  password={changePasswordForm.newPassword}
                  showStrength={true}
                />
              </div>
            )}
            
            <Input
              label={t('profileHub.confirmNewPassword')}
              type="password"
              value={changePasswordForm.confirmPassword}
              onChange={(e) => setChangePasswordForm({ ...changePasswordForm, confirmPassword: e.target.value })}
              error={formErrors.confirmPassword}
              required
            />
          </div>
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={() => setChangePasswordModal(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={handleChangePassword}
            disabled={modalLoading}
          >
            {modalLoading ? t('profileHub.changing') : t('profileHub.changePassword')}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Enable 2FA Modal */}
      <Dialog open={enable2FAModal} onClose={() => setEnable2FAModal(false)}>
        <DialogHeader onClose={() => setEnable2FAModal(false)}>
          <DialogTitle>{t('profileHub.enable2FATitle')}</DialogTitle>
          <DialogDescription>{t('profileHub.enable2FADesc')}</DialogDescription>
        </DialogHeader>
        <DialogContent>
          {twoFactorSetup?.qrCode ? (
            <div className="space-y-4">
              <div className="flex justify-center">
                <OptimizedImage
                  src={twoFactorSetup.qrCode}
                  alt="2FA QR-kod"
                  width={220}
                  height={220}
                  sizes="220px"
                  className="border border-gray-300 dark:border-gray-600 rounded-lg"
                  placeholder="blur"
                />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                {t('profileHub.scanQR')}
              </p>
              <Input
                label={t('profileHub.verificationCode')}
                type="text"
                value={twoFactorForm.code}
                onChange={(e) => setTwoFactorForm({ code: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                error={formErrors.code}
                placeholder="000000"
                maxLength={6}
                required
              />
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-600 dark:text-gray-400">{t('profileHub.configuring')}</p>
            </div>
          )}
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={() => setEnable2FAModal(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={handleVerify2FA}
            disabled={modalLoading || !twoFactorSetup?.qrCode}
          >
            {modalLoading ? t('profileHub.verifying') : t('profileHub.enable2FA')}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Delete Account Flow with cooling period */}
      <DeleteAccountFlow
        isOpen={deleteAccountModal}
        onDelete={async (password: string) => {
          if (!user?.user_id) throw new Error('No user ID');
          // Password re-authenticates the user before deletion
          await deleteAccount(user.user_id, password);
        }}
        onCancel={() => setDeleteAccountModal(false)}
      />

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        onClose={handleCloseSnackbar}
        message={snackbar.message}
        variant={snackbar.variant}
      />
    </div>
  );
};

export default ProfileHub;

