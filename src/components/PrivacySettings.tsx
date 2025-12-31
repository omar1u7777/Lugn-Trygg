/**
 * Privacy Settings Component
 * User controls for data privacy and GDPR compliance
 */

import React, { useState, useEffect } from 'react'
import { Card, Button } from './ui/tailwind';
import { useTranslation } from 'react-i18next';
import {
  PrivacySettings as IPrivacySettings,
  getPrivacySettings,
  savePrivacySettings,
  exportUserData,
  deleteAllUserData,
} from '../utils/encryptionService';
import { trackEvent } from '../services/analytics';
import { ArrowDownTrayIcon, EyeSlashIcon, LockClosedIcon, TrashIcon, ShieldCheckIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface PrivacySettingsProps {
  userId: string;
}

export const PrivacySettings: React.FC<PrivacySettingsProps> = ({ userId }) => {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<IPrivacySettings | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load settings from backend on mount
  useEffect(() => {
    const loadSettings = async () => {
      console.log('🔒 PRIVACY - Loading settings for user:', userId);
      setIsLoading(true);
      const loadedSettings = await getPrivacySettings(userId);
      console.log('⚙️ PRIVACY - Settings loaded:', loadedSettings);
      setSettings(loadedSettings);
      setIsLoading(false);
    };
    loadSettings();
  }, [userId]);

  const handleSettingChange = async (key: keyof IPrivacySettings, value: any) => {
    if (!settings) return;
    
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    await savePrivacySettings(newSettings, userId);
    
    trackEvent('privacy_setting_changed', {
      userId,
      setting: key,
      value,
    });
  };

  const handleExportData = async () => {
    setIsExporting(true);
    setExportError(null);
    setExportSuccess(false);
    
    try {
      console.log('📦 Starting data export for user:', userId);
      const dataBlob = await exportUserData(userId);
      
      // Create download link
      const url = URL.createObjectURL(dataBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lugn-trygg-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log('✅ Data export completed successfully');
      setExportSuccess(true);
      
      trackEvent('data_exported', { userId });
      
      // Auto-close dialog after 2 seconds
      setTimeout(() => {
        setShowExportDialog(false);
        setExportSuccess(false);
      }, 2000);
    } catch (error) {
      console.error('❌ Failed to export data:', error);
      setExportError(error instanceof Error ? error.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAllData = async () => {
    if (deleteConfirmText.toLowerCase() !== 'delete my data') {
      setDeleteError(t('privacy.confirmTextMismatch', 'Please type the confirmation text exactly'));
      return;
    }
    
    setIsDeleting(true);
    setDeleteError(null);
    
    try {
      console.log('🗑️ Starting permanent data deletion for user:', userId);
      await deleteAllUserData(userId);
      
      console.log('✅ Data deletion completed successfully');
      trackEvent('data_deleted', { userId });
      
      // Clear auth state and redirect
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      setShowDeleteDialog(false);
      
      // Redirect to homepage after short delay
      setTimeout(() => {
        window.location.href = '/';
      }, 1000);
    } catch (error) {
      console.error('❌ Failed to delete data:', error);
      setDeleteError(error instanceof Error ? error.message : 'Deletion failed');
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <ShieldCheckIcon className="w-8 h-8 text-primary-600 dark:text-primary-500" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('privacy.title', 'Privacy & Security')}
        </h2>
      </div>

      {isLoading ? (
        <Card>
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading privacy settings...</p>
          </div>
        </Card>
      ) : !settings ? (
        <Card>
          <div className="p-8 text-center">
            <p className="text-red-600 dark:text-red-400">Failed to load privacy settings</p>
          </div>
        </Card>
      ) : (
        <>
          {/* Encryption Settings */}
          <Card>
            <div className="p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <LockClosedIcon className="w-5 h-5 text-primary-600 dark:text-primary-500" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {t('privacy.encryption', 'Data Encryption')}
                </h3>
              </div>
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <ShieldCheckIcon className="w-5 h-5 text-primary-600 dark:text-primary-500" />
                      <p className="font-medium text-gray-900 dark:text-white">
                        {t('privacy.encryptLocalStorage', 'Encrypt Local Data')}
                      </p>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {t('privacy.encryptLocalStorageDesc', 'All sensitive data stored locally will be encrypted')}
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.encryptLocalStorage}
                      onChange={(e) => handleSettingChange('encryptLocalStorage', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-500 dark:peer-focus:ring-primary-600 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                  </label>
                </div>
              </div>
            </div>
          </Card>

      {/* Data Retention */}
      <Card>
        <div className="p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {t('privacy.dataRetention', 'Data Retention')}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {t('privacy.dataRetentionDesc', 'How long should we keep your data?')}
          </p>
          <div className="mb-6">
            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
              <span>1 month</span>
              <span>6 months</span>
              <span>1 year</span>
              <span>2 years</span>
            </div>
            <input
              type="range"
              min="30"
              max="730"
              step="30"
              value={settings.dataRetentionDays}
              onChange={(e) => handleSettingChange('dataRetentionDays', parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
            />
            <div className="text-center mt-2">
              <span className="text-base font-semibold text-gray-900 dark:text-white">
                {Math.round(settings.dataRetentionDays / 30)} {t('privacy.months', 'months')}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between gap-4">
            <label className="flex-1 text-sm text-gray-700 dark:text-gray-300">
              {t('privacy.autoDelete', 'Automatically delete data older than retention period')}
            </label>
            <input
              type="checkbox"
              checked={settings.autoDeleteOldData}
              onChange={(e) => handleSettingChange('autoDeleteOldData', e.target.checked)}
              className="w-12 h-6 appearance-none bg-gray-200 rounded-full checked:bg-primary-600 relative cursor-pointer transition-colors before:content-[''] before:absolute before:w-5 before:h-5 before:bg-white before:rounded-full before:top-0.5 before:left-0.5 before:transition-transform checked:before:translate-x-6"
            />
          </div>
        </div>
      </Card>

      {/* Analytics & Sharing */}
      <Card>
        <div className="p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <EyeSlashIcon className="w-5 h-5 text-primary-600 dark:text-primary-500" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('privacy.sharing', 'Analytics & Sharing')}
            </h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="font-medium text-gray-900 dark:text-white mb-1">
                  {t('privacy.allowAnalytics', 'Allow Usage Analytics')}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('privacy.allowAnalyticsDesc', 'Help us improve the app by sharing anonymous usage data')}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.allowAnalytics}
                  onChange={(e) => handleSettingChange('allowAnalytics', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-500 dark:peer-focus:ring-primary-600 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
              </label>
            </div>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="font-medium text-gray-900 dark:text-white mb-1">
                  {t('privacy.shareAnonymized', 'Share Anonymized Data')}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('privacy.shareAnonymizedDesc', 'Contribute to mental health research (fully anonymous)')}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.shareAnonymizedData}
                  onChange={(e) => handleSettingChange('shareAnonymizedData', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-500 dark:peer-focus:ring-primary-600 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
              </label>
            </div>
          </div>
        </div>
      </Card>

      <div className="border-t border-gray-200 dark:border-gray-700 my-6"></div>

      {/* GDPR Rights */}
      <Card>
        <div className="p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {t('privacy.yourRights', 'Your Privacy Rights')}
          </h3>
          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              {t('privacy.gdprInfo', 'Under GDPR and data protection laws, you have the right to access, export, and delete your personal data.')}
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              onClick={() => setShowExportDialog(true)}
              className="flex items-center justify-center gap-2"
            >
              <ArrowDownTrayIcon className="w-5 h-5" />
              {t('privacy.exportData', 'Export My Data')}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(true)}
              className="flex items-center justify-center gap-2 border-error-500 text-error-600 hover:bg-error-50 dark:border-error-700 dark:text-error-400 dark:hover:bg-error-900/30"
            >
              <TrashIcon className="w-5 h-5" />
              {t('privacy.deleteData', 'Delete All My Data')}
            </Button>
          </div>
        </div>
      </Card>

      <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
        <span className="mr-2" role="img" aria-label="lock">🔒</span>
        <span className="font-medium">{t('privacy.commitment', 'Your privacy is our top priority. All data is encrypted and stored securely.')}</span>
      </p>

      {/* Export Data Dialog */}
      {showExportDialog && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowExportDialog(false)}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {t('privacy.exportDataTitle', 'Export Your Data')}
              </h2>
              <button
                onClick={() => setShowExportDialog(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                aria-label={t('common.close', 'Close')}
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {t('privacy.exportDataDesc', 'We will create a JSON file containing all your personal data, including mood logs, memories, and settings.')}
            </p>
            
            {exportError && (
              <div className="bg-error-50 dark:bg-error-900/30 border border-error-200 dark:border-error-800 rounded-lg p-3 mb-4">
                <p className="text-sm text-error-800 dark:text-error-300">
                  ❌ {exportError}
                </p>
              </div>
            )}
            
            {exportSuccess && (
              <div className="bg-success-50 dark:bg-success-900/30 border border-success-200 dark:border-success-800 rounded-lg p-3 mb-4">
                <p className="text-sm text-success-800 dark:text-success-300">
                  ✅ {t('privacy.exportSuccess', 'Data exported successfully!')}
                </p>
              </div>
            )}
            
            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-6">
              <p className="text-xs text-blue-800 dark:text-blue-300">
                {t('privacy.exportDataNote', 'This file will be downloaded to your device and can be used to back up your data or transfer it to another service.')}
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowExportDialog(false);
                  setExportError(null);
                  setExportSuccess(false);
                }}
                disabled={isExporting}
                className="flex-1"
              >
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button
                onClick={handleExportData}
                disabled={isExporting}
                className="flex-1 flex items-center justify-center gap-2"
              >
                {isExporting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    {t('privacy.exporting', 'Exporting...')}
                  </>
                ) : (
                  <>
                    <ArrowDownTrayIcon className="w-5 h-5" />
                    {t('privacy.downloadData', 'Download Data')}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Data Dialog */}
      {showDeleteDialog && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowDeleteDialog(false)}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-xl font-semibold text-error-600 dark:text-error-400">
                {t('privacy.deleteDataTitle', 'Delete All Your Data')}
              </h2>
              <button
                onClick={() => setShowDeleteDialog(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                aria-label={t('common.close', 'Close')}
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            
            <div className="bg-error-50 dark:bg-error-900/30 border border-error-200 dark:border-error-800 rounded-lg p-4 mb-4">
              <p className="text-sm text-error-800 dark:text-error-300 font-medium">
                {t('privacy.deleteDataWarning', 'This action is permanent and cannot be undone. All your mood logs, memories, and personal data will be deleted forever.')}
              </p>
            </div>
            
            {deleteError && (
              <div className="bg-error-50 dark:bg-error-900/30 border border-error-200 dark:border-error-800 rounded-lg p-3 mb-4">
                <p className="text-sm text-error-800 dark:text-error-300">
                  ❌ {deleteError}
                </p>
              </div>
            )}
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('privacy.deleteDataConfirm', 'To confirm, please type "delete my data" below:')}
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => {
                  setDeleteConfirmText(e.target.value);
                  setDeleteError(null);
                }}
                disabled={isDeleting}
                placeholder="delete my data"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-error-500 dark:focus:ring-error-600 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteDialog(false);
                  setDeleteConfirmText('');
                  setDeleteError(null);
                }}
                disabled={isDeleting}
                className="flex-1"
              >
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button
                onClick={handleDeleteAllData}
                disabled={deleteConfirmText.toLowerCase() !== 'delete my data' || isDeleting}
                className="flex-1 bg-error-600 hover:bg-error-700 dark:bg-error-700 dark:hover:bg-error-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    {t('privacy.deleting', 'Deleting...')}
                  </>
                ) : (
                  <>
                    <TrashIcon className="w-5 h-5" />
                    {t('privacy.confirmDelete', 'Delete Forever')}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};

export default PrivacySettings;

