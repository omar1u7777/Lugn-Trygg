/**
 * Privacy Settings Component
 * User controls for data privacy and GDPR compliance
 */

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Switch,
  FormControlLabel,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Slider,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import LockIcon from '@mui/icons-material/Lock';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import DownloadIcon from '@mui/icons-material/Download';
import SecurityIcon from '@mui/icons-material/Security';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import {
  PrivacySettings as IPrivacySettings,
  getPrivacySettings,
  savePrivacySettings,
  exportUserData,
  deleteAllUserData,
} from '../utils/encryptionService';
import { trackEvent } from '../services/analytics';

interface PrivacySettingsProps {
  userId: string;
}

export const PrivacySettings: React.FC<PrivacySettingsProps> = ({ userId }) => {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<IPrivacySettings>(getPrivacySettings());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const handleSettingChange = (key: keyof IPrivacySettings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    savePrivacySettings(newSettings);
    
    trackEvent('privacy_setting_changed', {
      userId,
      setting: key,
      value,
    });
  };

  const handleExportData = async () => {
    try {
      const dataBlob = await exportUserData(userId);
      const url = URL.createObjectURL(dataBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lugn-trygg-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      trackEvent('data_exported', { userId });
      setShowExportDialog(false);
    } catch (error) {
      console.error('Failed to export data:', error);
    }
  };

  const handleDeleteAllData = async () => {
    if (deleteConfirmText.toLowerCase() === 'delete my data') {
      try {
        await deleteAllUserData(userId);
        trackEvent('data_deleted', { userId });
        setShowDeleteDialog(false);
        // Redirect to logout or homepage
        window.location.href = '/';
      } catch (error) {
        console.error('Failed to delete data:', error);
      }
    }
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <SecurityIcon color="primary" />
        {t('privacy.title', 'Privacy & Security')}
      </Typography>

      {/* Encryption Settings */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <LockIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            {t('privacy.encryption', 'Data Encryption')}
          </Typography>
          <List>
            <ListItem>
              <ListItemIcon>
                <SecurityIcon color="primary" />
              </ListItemIcon>
              <ListItemText
                primary={t('privacy.encryptLocalStorage', 'Encrypt Local Data')}
                secondary={t('privacy.encryptLocalStorageDesc', 'All sensitive data stored locally will be encrypted')}
              />
              <Switch
                checked={settings.encryptLocalStorage}
                onChange={(e) => handleSettingChange('encryptLocalStorage', e.target.checked)}
              />
            </ListItem>
          </List>
        </CardContent>
      </Card>

      {/* Data Retention */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {t('privacy.dataRetention', 'Data Retention')}
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {t('privacy.dataRetentionDesc', 'How long should we keep your data?')}
          </Typography>
          <Box sx={{ px: 2, mt: 2 }}>
            <Slider
              value={settings.dataRetentionDays}
              onChange={(_e, value) => handleSettingChange('dataRetentionDays', value)}
              min={30}
              max={730}
              step={30}
              marks={[
                { value: 30, label: '1 month' },
                { value: 180, label: '6 months' },
                { value: 365, label: '1 year' },
                { value: 730, label: '2 years' },
              ]}
              valueLabelDisplay="on"
              valueLabelFormat={(value) => `${Math.round(value / 30)} months`}
            />
          </Box>
          <FormControlLabel
            control={
              <Switch
                checked={settings.autoDeleteOldData}
                onChange={(e) => handleSettingChange('autoDeleteOldData', e.target.checked)}
              />
            }
            label={t('privacy.autoDelete', 'Automatically delete data older than retention period')}
            sx={{ mt: 2 }}
          />
        </CardContent>
      </Card>

      {/* Analytics & Sharing */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <VisibilityOffIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            {t('privacy.sharing', 'Analytics & Sharing')}
          </Typography>
          <List>
            <ListItem>
              <ListItemText
                primary={t('privacy.allowAnalytics', 'Allow Usage Analytics')}
                secondary={t('privacy.allowAnalyticsDesc', 'Help us improve the app by sharing anonymous usage data')}
              />
              <Switch
                checked={settings.allowAnalytics}
                onChange={(e) => handleSettingChange('allowAnalytics', e.target.checked)}
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary={t('privacy.shareAnonymized', 'Share Anonymized Data')}
                secondary={t('privacy.shareAnonymizedDesc', 'Contribute to mental health research (fully anonymous)')}
              />
              <Switch
                checked={settings.shareAnonymizedData}
                onChange={(e) => handleSettingChange('shareAnonymizedData', e.target.checked)}
              />
            </ListItem>
          </List>
        </CardContent>
      </Card>

      <Divider sx={{ my: 3 }} />

      {/* GDPR Rights */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {t('privacy.yourRights', 'Your Privacy Rights')}
          </Typography>
          <Alert severity="info" sx={{ mb: 2 }}>
            {t('privacy.gdprInfo', 'Under GDPR and data protection laws, you have the right to access, export, and delete your personal data.')}
          </Alert>
          
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={() => setShowExportDialog(true)}
            >
              {t('privacy.exportData', 'Export My Data')}
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteForeverIcon />}
              onClick={() => setShowDeleteDialog(true)}
            >
              {t('privacy.deleteData', 'Delete All My Data')}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Export Data Dialog */}
      <Dialog open={showExportDialog} onClose={() => setShowExportDialog(false)}>
        <DialogTitle>{t('privacy.exportDataTitle', 'Export Your Data')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" gutterBottom>
            {t('privacy.exportDataDesc', 'We will create a JSON file containing all your personal data, including mood logs, memories, and settings.')}
          </Typography>
          <Alert severity="info" sx={{ mt: 2 }}>
            {t('privacy.exportDataNote', 'This file will be downloaded to your device and can be used to back up your data or transfer it to another service.')}
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowExportDialog(false)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button onClick={handleExportData} variant="contained" startIcon={<DownloadIcon />}>
            {t('privacy.downloadData', 'Download Data')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Data Dialog */}
      <Dialog open={showDeleteDialog} onClose={() => setShowDeleteDialog(false)}>
        <DialogTitle sx={{ color: 'error.main' }}>
          {t('privacy.deleteDataTitle', 'Delete All Your Data')}
        </DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 2 }}>
            {t('privacy.deleteDataWarning', 'This action is permanent and cannot be undone. All your mood logs, memories, and personal data will be deleted forever.')}
          </Alert>
          <Typography variant="body2" gutterBottom>
            {t('privacy.deleteDataConfirm', 'To confirm, please type "delete my data" below:')}
          </Typography>
          <Box
            component="input"
            type="text"
            value={deleteConfirmText}
            onChange={(e: any) => setDeleteConfirmText(e.target.value)}
            placeholder="delete my data"
            sx={{
              width: '100%',
              mt: 2,
              p: 1,
              border: '1px solid #ccc',
              borderRadius: 1,
              fontSize: '1rem',
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDeleteDialog(false)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            onClick={handleDeleteAllData}
            variant="contained"
            color="error"
            disabled={deleteConfirmText.toLowerCase() !== 'delete my data'}
            startIcon={<DeleteForeverIcon />}
          >
            {t('privacy.confirmDelete', 'Delete Forever')}
          </Button>
        </DialogActions>
      </Dialog>

      <Box sx={{ mt: 3, p: 2, bgcolor: '#E8F5E9', borderRadius: 2 }}>
        <Typography variant="body2">
          🔒 <strong>{t('privacy.commitment', 'Our Commitment:')}</strong> {t('privacy.commitmentDesc', 'Your privacy and security are our top priority. We use industry-standard encryption and never share your personal data without your explicit consent.')}
        </Typography>
      </Box>
    </Box>
  );
};

export default PrivacySettings;
