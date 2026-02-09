import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Dialog, DialogHeader, DialogTitle, DialogDescription, DialogContent, DialogFooter, Input, Snackbar } from './ui/tailwind';
import { useTranslation } from 'react-i18next';
import PrivacySettings from './PrivacySettings';
import { ThemeToggle } from './ui/ThemeToggle';
import LanguageSwitcher from './LanguageSwitcher';
import OptimizedImage from './ui/OptimizedImage';
import useAuth from '../hooks/useAuth';
import { useSubscription } from '../contexts/SubscriptionContext';
import { getMoods, getChatHistory, getMemories, changeEmail, changePassword, setup2FA, verify2FASetup, exportUserData, deleteAccount } from '../api/api';
import { getUserProfile, updateUserPreferences } from '../api/users';
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
  CreditCardIcon
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

interface ProfileStats {
  totalMoods: number;
  totalConversations: number;
  totalMemories: number;
  accountAge: number;
}

const ProfileHub: React.FC = () => {
  const { t: _t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { plan, isPremium, isTrial, usage, getRemainingMoodLogs, getRemainingMessages } = useSubscription();
  const [activeTab, setActiveTab] = useState(0);
  const [settings, setSettings] = useState({
    emailNotifications: true,
    pushNotifications: false,
    dataSharing: false,
    publicProfile: false,
  });
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

  // Snackbar state
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    variant: 'info' as 'success' | 'error' | 'warning' | 'info'
  });

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
        logger.debug('📊 PROFILE HUB - Fetching moods, chats, memories, profile...');
        // Fetch user activity data and saved preferences
        const [moods, chatHistoryResult, memories, profileResult] = await Promise.allSettled([
          getMoods(user.user_id),
          getChatHistory(user.user_id),
          getMemories(user.user_id),
          getUserProfile(),
        ]);

        // Load saved settings from profile
        const profile = profileResult.status === 'fulfilled' ? profileResult.value : null;
        if (profile?.preferences) {
          setSettings(prev => ({
            ...prev,
            ...(typeof profile.preferences === 'object' ? profile.preferences : {}),
          }));
        }

        // Calculate account age from user creation date
        let accountAge = 0;
        if (user.createdAt) {
          const created = typeof user.createdAt === 'string' ? new Date(user.createdAt) : user.createdAt;
          if (!isNaN(created.getTime())) {
            accountAge = Math.max(1, Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24)));
          }
        }

        const moodsData = moods.status === 'fulfilled' ? moods.value : [];
        const chatData = chatHistoryResult.status === 'fulfilled' ? chatHistoryResult.value : { conversation: [] };
        const memoriesData = memories.status === 'fulfilled' ? memories.value : [];

        setProfileStats({
          totalMoods: Array.isArray(moodsData) ? moodsData.length : 0,
          totalConversations: chatData?.conversation?.length || 0,
          totalMemories: Array.isArray(memoriesData) ? memoriesData.length : 0,
          accountAge,
        });
        logger.debug('✅ PROFILE HUB - Stats calculated', { totalMoods: profileStats.totalMoods, accountAge });
      } catch (error: unknown) {
        logger.error('❌ PROFILE HUB - Failed to fetch profile data:', error);
        // CRITICAL FIX: Better error handling with user-friendly messages
        const errorMessage = error instanceof Error && 'response' in error && typeof error.response === 'object' && error.response && 'data' in error.response && typeof error.response.data === 'object' && error.response.data && 'error' in error.response.data
          ? String(error.response.data.error)
          : error instanceof Error ? error.message : 'Kunde inte ladda profildata';
        // CRITICAL FIX: Log error (component doesn't have error state, but we log it)
        logger.error('Profile data fetch error:', errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [user?.user_id]);

  const _handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    logger.debug('👤 PROFILE HUB - Tab changed', { newTab: newValue });
    setActiveTab(newValue);
  };

  const handleSettingChange = (setting: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const newSettings = { ...settings, [setting]: event.target.checked };
    setSettings(newSettings);
    // Persist to backend
    updateUserPreferences(newSettings).catch((err) => {
      logger.error('Failed to save setting', err);
      showSnackbar('Kunde inte spara inställning', 'error');
      // Revert on failure
      setSettings(settings);
    });
  };

  // Modal handlers
  const showSnackbar = (message: string, variant: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setSnackbar({ open: true, message, variant });
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const validateEmail = (email: string): string | null => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) return 'E-postadress krävs';
    if (!emailRegex.test(email)) return 'Ogiltig e-postadress';
    return null;
  };

  const validatePassword = (password: string): string | null => {
    if (!password) return 'Lösenord krävs';
    if (password.length < 8) return 'Lösenord måste vara minst 8 tecken';
    if (!/[A-Z]/.test(password)) return 'Lösenord måste innehålla stor bokstav';
    if (!/[a-z]/.test(password)) return 'Lösenord måste innehålla liten bokstav';
    if (!/\d/.test(password)) return 'Lösenord måste innehålla siffra';
    if (!/[!@#$%^&*()_+\-=\[\]{};\':"\\|,.<>\/?]/.test(password)) return 'Lösenord måste innehålla specialtecken';
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
      // Refresh user data if needed
      window.location.reload();
    } catch (error: any) {
      showSnackbar(error.message || 'Kunde inte ändra e-post', 'error');
    } finally {
      setModalLoading(false);
    }
  };

  const handleChangePassword = async () => {
    setFormErrors({});
    const { currentPassword, newPassword, confirmPassword } = changePasswordForm;

    if (!currentPassword) {
      setFormErrors({ currentPassword: 'Nuvarande lösenord krävs' });
      return;
    }

    const passwordError = validatePassword(newPassword);
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
    } catch (error: any) {
      showSnackbar(error.message || 'Kunde inte ändra lösenord', 'error');
    } finally {
      setModalLoading(false);
    }
  };

  const handleEnable2FA = async () => {
    setModalLoading(true);
    try {
      const setupData = await setup2FA();
      setTwoFactorSetup({
        qrCode: setupData.qr_code,
        secret: setupData.secret,
        provisioningUri: setupData.provisioning_uri
      });
      setEnable2FAModal(true);
    } catch (error: any) {
      showSnackbar(error.message || 'Kunde inte aktivera 2FA', 'error');
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
    } catch (error: any) {
      showSnackbar(error.message || 'Kunde inte verifiera 2FA', 'error');
    } finally {
      setModalLoading(false);
    }
  };

  const handleExportData = async () => {
    setModalLoading(true);
    try {
      await exportUserData();
      showSnackbar('Din data har exporterats!', 'success');
    } catch (error: any) {
      showSnackbar(error.message || 'Kunde inte exportera data', 'error');
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user?.user_id) return;

    setModalLoading(true);
    try {
      await deleteAccount(user.user_id);
      showSnackbar('Kontot raderas. Du loggas ut.', 'success');
      // Logout user
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
    } catch (error: any) {
      showSnackbar(error.message || 'Kunde inte radera kontot', 'error');
    } finally {
      setModalLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
      {/* Identity Card Hero */}
      <div className="mb-8">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-slate-800 to-slate-900 dark:from-indigo-900 dark:to-slate-900 text-white shadow-2xl p-8 sm:p-10">
          {/* Background Decor */}
          <div className="absolute top-0 right-0 p-40 bg-white/5 rounded-full blur-3xl transform translate-x-1/3 -translate-y-1/3 pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-8">
            {/* Avatar Section */}
            <div className="relative">
              <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full p-1 bg-gradient-to-br from-indigo-400 to-purple-400 shadow-xl">
                <div className="w-full h-full rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-5xl sm:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-indigo-500 to-purple-600">
                  {user?.email?.charAt(0).toUpperCase() || '👤'}
                </div>
              </div>
              {isPremium && (
                <div className="absolute -bottom-2 -right-2 bg-gradient-to-r from-amber-400 to-amber-600 text-white px-4 py-1.5 rounded-full text-sm font-bold shadow-lg border-2 border-slate-900 flex items-center gap-1">
                  <StarIcon className="w-4 h-4" />
                  PREMIUM
                </div>
              )}
            </div>

            {/* Info Section */}
            <div className="text-center md:text-left flex-1">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-2 tracking-tight">
                {user?.email || 'Gäst'}
              </h1>
              <p className="text-indigo-200 text-lg mb-6 max-w-lg mx-auto md:mx-0">
                {user?.email ? 'Hantera din personliga resa, inställningar och säkerhet.' : 'Logga in för att spara din data.'}
              </p>

              <div className="flex flex-wrap justify-center md:justify-start gap-3">
                <div className="px-4 py-2 bg-white/10 backdrop-blur-md rounded-xl border border-white/10 text-sm font-medium flex items-center gap-2">
                  <UserIcon className="w-4 h-4 text-indigo-300" />
                  Medlem i {profileStats.accountAge} dagar
                </div>
                {!isPremium && (
                  <Button
                    variant="primary"
                    size="small"
                    onClick={() => navigate('/upgrade')}
                    className="bg-amber-500 hover:bg-amber-600 text-white border-none shadow-lg shadow-amber-500/20"
                  >
                    Uppgradera nu
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
          { label: 'Humörloggar', value: profileStats.totalMoods, icon: HeartIcon, color: 'text-pink-500', bg: 'bg-pink-50 dark:bg-pink-900/20' },
          { label: 'AI-samtal', value: profileStats.totalConversations, icon: ChatBubbleLeftIcon, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
          { label: 'Minnen', value: profileStats.totalMemories, icon: SparklesIcon, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20' },
          { label: 'Dagar aktiv', value: `${profileStats.accountAge}d`, icon: UserIcon, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20' }
        ].map((stat, index) => (
          <div key={index} className="group bg-white dark:bg-slate-800 rounded-3xl p-6 border border-gray-100 dark:border-gray-700/50 shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all duration-300">
            <div className={`w-12 h-12 rounded-2xl ${stat.bg} ${stat.color} flex items-center justify-center mb-4 transition-transform group-hover:rotate-6`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
              {loading ? <span className="inline-block w-8 h-8 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" /> : stat.value}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* Subscription Status Card - REAL IMPLEMENTATION */}
      <Card className={`mb-6 sm:mb-8 ${isPremium ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700'}`}>
        <div className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center ${isPremium ? 'bg-white/20' : 'bg-gray-300 dark:bg-gray-600'}`}>
                {isPremium ? (
                  <StarIcon className="w-8 h-8 text-white" />
                ) : (
                  <CreditCardIcon className="w-8 h-8 text-gray-600 dark:text-gray-400" />
                )}
              </div>
              <div>
                <h3 className={`text-xl sm:text-2xl font-bold ${isPremium ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                  {isPremium ? '⭐ Premium-medlem' : isTrial ? '🎁 Provperiod' : '🆓 Gratis-plan'}
                </h3>
                <p className={`text-sm ${isPremium ? 'text-white/80' : 'text-gray-600 dark:text-gray-400'}`}>
                  {isPremium
                    ? 'Obegränsad tillgång till alla funktioner'
                    : `${getRemainingMoodLogs()} humörloggningar kvar idag • ${getRemainingMessages()} chattmeddelanden kvar`
                  }
                </p>
              </div>
            </div>

            {!isPremium && (
              <Button
                variant="primary"
                className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold"
                onClick={() => navigate('/upgrade')}
              >
                Uppgradera till Premium
              </Button>
            )}
          </div>

          {/* Usage bars for free users */}
          {!isPremium && (
            <div className="mt-4 pt-4 border-t border-gray-300 dark:border-gray-600">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700 dark:text-gray-300">Humörloggningar</span>
                    <span className="font-medium text-gray-900 dark:text-white">{usage.moodLogs}/{plan.limits.moodLogsPerDay}</span>
                  </div>
                  <div className="w-full bg-gray-300 dark:bg-gray-600 rounded-full h-2">
                    <div
                      className="bg-primary-500 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min((usage.moodLogs / plan.limits.moodLogsPerDay) * 100, 100)}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700 dark:text-gray-300">Chattmeddelanden</span>
                    <span className="font-medium text-gray-900 dark:text-white">{usage.chatMessages}/{plan.limits.chatMessagesPerDay}</span>
                  </div>
                  <div className="w-full bg-gray-300 dark:bg-gray-600 rounded-full h-2">
                    <div
                      className="bg-secondary-500 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min((usage.chatMessages / plan.limits.chatMessagesPerDay) * 100, 100)}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700 dark:text-gray-300">Historik</span>
                    <span className="font-medium text-gray-900 dark:text-white">{plan.limits.historyDays} dagar</span>
                  </div>
                  <div className="w-full bg-gray-300 dark:bg-gray-600 rounded-full h-2">
                    <div className="bg-amber-500 h-2 rounded-full" style={{ width: '30%' }} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Tabs for different profile sections */}
      <Card className="world-class-dashboard-card">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex overflow-x-auto" role="tablist" aria-label="Profile sections">
            {[
              { icon: <UserIcon className="w-5 h-5" />, label: 'Kontoinställningar', index: 0 },
              { icon: <ShieldCheckIcon className="w-5 h-5" />, label: 'Integritet', index: 1 },
              { icon: <BellIcon className="w-5 h-5" />, label: 'Notiser', index: 2 },
              { icon: <Cog6ToothIcon className="w-5 h-5" />, label: 'Utseende', index: 3 },
            ].map((tab) => (
              <button
                key={tab.index}
                onClick={() => setActiveTab(tab.index)}
                role="tab"
                className={`flex items-center gap-2 px-4 sm:px-6 py-3 sm:py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${activeTab === tab.index
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                  }`}
                id={`profile-tab-${tab.index}`}
                aria-controls={`profile-tabpanel-${tab.index}`}
                aria-selected={activeTab === tab.index}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-4 sm:p-6">
          {/* Account Settings Tab */}
          <TabPanel value={activeTab} index={0}>
            <div className="space-y-4 sm:space-y-6">
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6">
                Kontoinformation
              </h3>
              <div className="space-y-4">
                <Card className="border border-gray-200 dark:border-gray-700">
                  <div className="p-4 sm:p-6">
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1 sm:mb-2">
                      E-postadress
                    </p>
                    <p className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">
                      {user?.email || 'Ej inloggad'}
                    </p>
                    <Button
                      variant="outline"
                      size="small"
                      onClick={() => setChangeEmailModal(true)}
                    >
                      Ändra e-post
                    </Button>
                  </div>
                </Card>

                <Card className="border border-gray-200 dark:border-gray-700">
                  <div className="p-4 sm:p-6">
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1 sm:mb-2">
                      Lösenord
                    </p>
                    <p className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">
                      ••••••••••
                    </p>
                    <Button
                      variant="outline"
                      size="small"
                      onClick={() => setChangePasswordModal(true)}
                    >
                      Ändra lösenord
                    </Button>
                  </div>
                </Card>

                <Card className="border border-gray-200 dark:border-gray-700">
                  <div className="p-4 sm:p-6">
                    <h4 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-2 sm:mb-3">
                      🔐 Tvåfaktorsautentisering
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Lägg till ett extra lager av säkerhet på ditt konto
                    </p>
                    <Button
                      variant="primary"
                      className="bg-warning-600 hover:bg-warning-700"
                      onClick={handleEnable2FA}
                      disabled={modalLoading}
                    >
                      {modalLoading ? 'Konfigurerar...' : 'Aktivera 2FA'}
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
                  Logga in för att hantera integritetsinställningar
                </p>
              </div>
            )}
          </TabPanel>

          {/* Notifications Tab */}
          <TabPanel value={activeTab} index={2}>
            <div className="space-y-4 sm:space-y-6">
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6">
                Aviseringsinställningar
              </h3>
              <div className="space-y-4">
                <Card className="border border-gray-200 dark:border-gray-700">
                  <label className="flex items-center justify-between p-4 sm:p-6 cursor-pointer">
                    <div className="flex-1">
                      <p className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                        E-postnotiser
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Ta emot uppdateringar och insikter via e-post
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
                        Push-notiser
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Få aviseringar i realtid på din enhet
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
                    Vill du aktivera webläsarnotiser?
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
                    Aktivera webläsarnotiser
                  </Button>
                </div>
              </div>
            </div>
          </TabPanel>

          {/* Appearance Tab */}
          <TabPanel value={activeTab} index={3}>
            <div className="space-y-4 sm:space-y-6">
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6">
                Utseendeinställningar
              </h3>
              <div className="space-y-4">
                <Card className="border border-gray-200 dark:border-gray-700">
                  <div className="p-4 sm:p-6">
                    <h4 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      Temaläge
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Växla mellan ljust och mörkt läge
                    </p>
                    <ThemeToggle />
                  </div>
                </Card>

                <Card className="border border-gray-200 dark:border-gray-700">
                  <div className="p-4 sm:p-6">
                    <h4 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      Språk
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Välj ditt föredragna språk
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
            Kontoåtgärder
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              variant="outline"
              className="w-full min-h-[44px] flex items-center justify-center gap-2"
              onClick={handleExportData}
              disabled={modalLoading}
            >
              <ShieldCheckIcon className="w-5 h-5" aria-hidden="true" />
              <span>{modalLoading ? 'Exporterar...' : 'Exportera min data'}</span>
            </Button>
            <Button
              variant="outline"
              className="w-full min-h-[44px] text-error-600 border-error-600 hover:bg-error-50 dark:hover:bg-error-900/20"
              onClick={() => setDeleteAccountModal(true)}
            >
              Radera konto
            </Button>
          </div>
        </div>
      </Card>

      {/* Change Email Modal */}
      <Dialog open={changeEmailModal} onClose={() => setChangeEmailModal(false)}>
        <DialogHeader onClose={() => setChangeEmailModal(false)}>
          <DialogTitle>Ändra e-postadress</DialogTitle>
          <DialogDescription>
            Ange din nya e-postadress och nuvarande lösenord för att ändra din e-post.
          </DialogDescription>
        </DialogHeader>
        <DialogContent>
          <div className="space-y-4">
            <Input
              label="Ny e-postadress"
              type="email"
              value={changeEmailForm.newEmail}
              onChange={(e) => setChangeEmailForm({ ...changeEmailForm, newEmail: e.target.value })}
              error={formErrors.newEmail}
              required
            />
            <Input
              label="Nuvarande lösenord"
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
            Avbryt
          </Button>
          <Button
            variant="primary"
            onClick={handleChangeEmail}
            disabled={modalLoading}
          >
            {modalLoading ? 'Ändrar...' : 'Ändra e-post'}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Change Password Modal */}
      <Dialog open={changePasswordModal} onClose={() => setChangePasswordModal(false)}>
        <DialogHeader onClose={() => setChangePasswordModal(false)}>
          <DialogTitle>Ändra lösenord</DialogTitle>
          <DialogDescription>
            Ange ditt nuvarande lösenord och välj ett nytt säkert lösenord.
          </DialogDescription>
        </DialogHeader>
        <DialogContent>
          <div className="space-y-4">
            <Input
              label="Nuvarande lösenord"
              type="password"
              value={changePasswordForm.currentPassword}
              onChange={(e) => setChangePasswordForm({ ...changePasswordForm, currentPassword: e.target.value })}
              error={formErrors.currentPassword}
              required
            />
            <Input
              label="Nytt lösenord"
              type="password"
              value={changePasswordForm.newPassword}
              onChange={(e) => setChangePasswordForm({ ...changePasswordForm, newPassword: e.target.value })}
              error={formErrors.newPassword}
              helperText="Minst 8 tecken med stor bokstav, liten bokstav, siffra och specialtecken"
              required
            />
            <Input
              label="Bekräfta nytt lösenord"
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
            Avbryt
          </Button>
          <Button
            variant="primary"
            onClick={handleChangePassword}
            disabled={modalLoading}
          >
            {modalLoading ? 'Ändrar...' : 'Ändra lösenord'}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Enable 2FA Modal */}
      <Dialog open={enable2FAModal} onClose={() => setEnable2FAModal(false)}>
        <DialogHeader onClose={() => setEnable2FAModal(false)}>
          <DialogTitle>Aktivera tvåfaktorsautentisering</DialogTitle>
          <DialogDescription>
            Skanna QR-koden med din autentiseringsapp och ange den 6-siffriga koden.
          </DialogDescription>
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
                Skanna denna QR-kod med din autentiseringsapp (Google Authenticator, Authy, etc.)
              </p>
              <Input
                label="Verifieringskod"
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
              <p className="text-gray-600 dark:text-gray-400">Konfigurerar 2FA...</p>
            </div>
          )}
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={() => setEnable2FAModal(false)}>
            Avbryt
          </Button>
          <Button
            variant="primary"
            onClick={handleVerify2FA}
            disabled={modalLoading || !twoFactorSetup?.qrCode}
          >
            {modalLoading ? 'Verifierar...' : 'Aktivera 2FA'}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Delete Account Modal */}
      <Dialog open={deleteAccountModal} onClose={() => setDeleteAccountModal(false)}>
        <DialogHeader onClose={() => setDeleteAccountModal(false)}>
          <DialogTitle className="text-error-600">Radera konto</DialogTitle>
          <DialogDescription>
            Denna åtgärd kan inte ångras. Ditt konto och all tillhörande data kommer att raderas permanent.
          </DialogDescription>
        </DialogHeader>
        <DialogContent>
          <div className="space-y-4">
            <div className="bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-lg p-4">
              <h4 className="font-semibold text-error-800 dark:text-error-200 mb-2">
                Vad som kommer raderas:
              </h4>
              <ul className="text-sm text-error-700 dark:text-error-300 space-y-1">
                <li>• Alla humörloggar och analyser</li>
                <li>• Chatthistorik och konversationer</li>
                <li>• Sparade minnen och dagboksanteckningar</li>
                <li>• Kontoinställningar och preferenser</li>
                <li>• Wellness-mål och framsteg</li>
              </ul>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Din data kommer att raderas permanent inom 30 dagar. Du kan avbryta genom att kontakta support inom den tiden.
            </p>
          </div>
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDeleteAccountModal(false)}>
            Avbryt
          </Button>
          <Button
            variant="primary"
            className="bg-error-600 hover:bg-error-700"
            onClick={handleDeleteAccount}
            disabled={modalLoading}
          >
            {modalLoading ? 'Raderar...' : 'Radera konto'}
          </Button>
        </DialogFooter>
      </Dialog>

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

