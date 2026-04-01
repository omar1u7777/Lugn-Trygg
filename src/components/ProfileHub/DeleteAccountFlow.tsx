import React, { useState, useEffect } from 'react';
import { Card, Button, Dialog, DialogHeader, DialogTitle, DialogContent } from '../ui/tailwind';
import { useTranslation } from 'react-i18next';
import { 
  ExclamationTriangleIcon,
  ClockIcon,
  HeartIcon,
  ArrowPathIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { logger } from '../../utils/logger';

type DeleteStep = 'warning' | 'confirm' | 'cooldown' | 'done' | 'support';

interface DeleteAccountFlowProps {
  onDelete: () => Promise<void>;
  onCancel: () => void;
  isOpen: boolean;
}

// Check for distress patterns in recent activity
const hasRecentDistressPatterns = (_user: unknown): boolean => {
  // This would check for patterns like:
  // - Multiple mood logs with very low scores
  // - Recent searches for depression/suicide help
  // - Sudden increase in negative sentiment
  // For now, return false as placeholder
  return false;
};

const DeleteAccountFlow: React.FC<DeleteAccountFlowProps> = ({ 
  onDelete, 
  onCancel, 
  isOpen 
}) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<DeleteStep>('warning');
  const [cooldownDays, setCooldownDays] = useState(7);
  const [cooldownHours, setCooldownHours] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [hasScheduled, setHasScheduled] = useState(false);

  // Calculate remaining time
  useEffect(() => {
    if (step === 'cooldown' && hasScheduled) {
      const interval = setInterval(() => {
        // This would fetch from backend the actual remaining time
        // For demo, we'll just count down from 7 days
        setCooldownHours(prev => {
          if (prev <= 0) {
            setCooldownDays(d => {
              if (d <= 0) {
                clearInterval(interval);
                setStep('done');
                return 0;
              }
              return d - 1;
            });
            return 23; // 23 hours left in the day
          }
          return prev - 1;
        });
      }, 1000 * 60 * 60); // Update every hour

      return () => clearInterval(interval);
    }
  }, [step, hasScheduled]);

  const handleInitiateDelete = () => {
    // Check for distress patterns
    if (hasRecentDistressPatterns(null)) {
      setStep('support');
      return;
    }
    
    setStep('confirm');
  };

  const handleConfirmDelete = async () => {
    if (confirmText !== 'RADERA') {
      return;
    }

    setIsDeleting(true);
    try {
      // Schedule deletion with cooling period
      await onDelete();
      setHasScheduled(true);
      setStep('cooldown');
      logger.info('🗑️ DELETE ACCOUNT - Deletion scheduled with cooling period');
    } catch (error) {
      logger.error('❌ DELETE ACCOUNT - Failed to schedule deletion:', error);
      setIsDeleting(false);
    }
  };

  const handleCancelDeletion = async () => {
    try {
      // Call API to cancel scheduled deletion
      logger.info('🔄 DELETE ACCOUNT - User cancelled deletion');
      setStep('warning');
      setConfirmText('');
      setHasScheduled(false);
      onCancel();
    } catch (error) {
      logger.error('❌ DELETE ACCOUNT - Failed to cancel deletion:', error);
    }
  };

  const renderWarningStep = () => (
    <DialogContent>
      <div className="text-center">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/20 mb-4">
          <ExclamationTriangleIcon className="h-8 w-8 text-red-600 dark:text-red-400" />
        </div>
        
        <DialogTitle className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          {t('profileHub.deleteAccountWarning', 'Radera ditt konto?')}
        </DialogTitle>
        
        <div className="text-left space-y-3 text-sm text-gray-600 dark:text-gray-300 mb-6">
          <p className="flex items-start gap-2">
            <span className="text-red-500">•</span>
            {t('profileHub.deleteWarning1', 'All din data kommer att raderas permanent')}
          </p>
          <p className="flex items-start gap-2">
            <span className="text-red-500">•</span>
            {t('profileHub.deleteWarning2', 'Dina humörloggar, minnen och samtal försvinner')}
          </p>
          <p className="flex items-start gap-2">
            <span className="text-red-500">•</span>
            {t('profileHub.deleteWarning3', 'Du kan inte återställa kontot senare')}
          </p>
        </div>

        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-6">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            💡 {t('profileHub.deleteAlternative', 'Överväg att ta en paus istället. Du kan alltid komma tillbaka.')}
          </p>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onCancel}
            className="flex-1"
          >
            {t('common.cancel', 'Avbryt')}
          </Button>
          <Button
            variant="primary"
            onClick={handleInitiateDelete}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white"
          >
            {t('profileHub.continueToDelete', 'Fortsätt ändå')}
          </Button>
        </div>
      </div>
    </DialogContent>
  );

  const renderConfirmStep = () => (
    <DialogContent>
      <div className="text-center">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-amber-100 dark:bg-amber-900/20 mb-4">
          <ClockIcon className="h-8 w-8 text-amber-600 dark:text-amber-400" />
        </div>
        
        <DialogTitle className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          {t('profileHub.confirmDeleteTitle', 'Bekräfta radering')}
        </DialogTitle>
        
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          {t('profileHub.confirmDeleteDesc', 'För att skydda ditt konto får det en 7-dagars ångertid.')}
        </p>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            ✨ {t('profileHub.coolingPeriodBenefit', 'Du kan när som helst avbryta raderingen under dessa 7 dagar.')}
          </p>
        </div>

        <div className="text-left mb-6">
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
            {t('profileHub.typeToDelete', 'Skriv "RADERA" för att bekräfta:')}
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
            placeholder="RADERA"
          />
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => setStep('warning')}
            className="flex-1"
          >
            {t('common.back', 'Tillbaka')}
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirmDelete}
            disabled={confirmText !== 'RADERA' || isDeleting}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white"
          >
            {isDeleting ? t('common.loading', 'Laddar...') : t('profileHub.scheduleDeletion', 'Schemalägg radering')}
          </Button>
        </div>
      </div>
    </DialogContent>
  );

  const renderCooldownStep = () => (
    <DialogContent>
      <div className="text-center">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-amber-100 dark:bg-amber-900/20 mb-4">
          <ClockIcon className="h-8 w-8 text-amber-600 dark:text-amber-400 animate-pulse" />
        </div>
        
        <DialogTitle className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          {t('profileHub.deletionScheduled', 'Radering schemalagd')}
        </DialogTitle>
        
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-6 mb-6">
          <p className="text-2xl font-bold text-amber-800 dark:text-amber-200 mb-2">
            {cooldownDays}d {cooldownHours}h
          </p>
          <p className="text-sm text-amber-700 dark:text-amber-300">
            {t('profileHub.timeRemaining', 'Kvar tills radering')}
          </p>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
          {t('profileHub.cancelAnytime', 'Du kan avbryta när som helst innan tiden löper ut.')}
        </p>

        <Button
          variant="primary"
          onClick={handleCancelDeletion}
          className="w-full bg-amber-500 hover:bg-amber-600 text-white"
        >
          <ArrowPathIcon className="w-4 h-4 mr-2" />
          {t('profileHub.cancelDeletion', 'Avbryt radering')}
        </Button>
      </div>
    </DialogContent>
  );

  const renderSupportStep = () => (
    <DialogContent>
      <div className="text-center">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 dark:bg-blue-900/20 mb-4">
          <HeartIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
        </div>
        
        <DialogTitle className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          {t('profileHub.needSupport', 'Behöver du stöd?')}
        </DialogTitle>
        
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
          {t('profileHub.supportMessage', 'Vi märkte att du kanske har det svårt. Det finns hjälp att få.')}
        </p>

        <div className="space-y-3 text-left mb-6">
          <Card className="border-blue-200 dark:border-blue-800">
            <div className="p-4">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                📞 {t('profileHub.crisisLine', 'Krislinje')}
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                1177 - Vårdguiden<br />
                112 vid akut fara
              </p>
            </div>
          </Card>

          <Card className="border-blue-200 dark:border-blue-800">
            <div className="p-4">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                💬 {t('profileHub.chatSupport', 'Chattstöd')}
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Mind.se - Gratis psykologstöd<br />
                Jourhavande medmänniska
              </p>
            </div>
          </Card>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => setStep('warning')}
            className="flex-1"
          >
            {t('profileHub.iNeedHelp', 'Jag behöver hjälp')}
          </Button>
          <Button
            variant="primary"
            onClick={() => setStep('confirm')}
            className="flex-1"
          >
            {t('profileHub.continueAnyway', 'Fortsätt ändå')}
          </Button>
        </div>
      </div>
    </DialogContent>
  );

  const renderDoneStep = () => (
    <DialogContent>
      <div className="text-center">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/20 mb-4">
          <CheckCircleIcon className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>
        
        <DialogTitle className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          {t('profileHub.accountDeleted', 'Kontot har raderats')}
        </DialogTitle>
        
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
          {t('profileHub.thankYouForTime', 'Tack för tiden du spenderade hos Lugn & Trygg. Vi önskar dig allt gott.')}
        </p>

        <Button
          variant="primary"
          onClick={() => window.location.href = '/'}
          className="w-full"
        >
          {t('profileHub.goToFrontpage', 'Gå till startsidan')}
        </Button>
      </div>
    </DialogContent>
  );

  return (
    <Dialog open={isOpen} onClose={onCancel}>
      <DialogHeader onClose={onCancel} />
      
      {step === 'warning' && renderWarningStep()}
      {step === 'confirm' && renderConfirmStep()}
      {step === 'cooldown' && renderCooldownStep()}
      {step === 'support' && renderSupportStep()}
      {step === 'done' && renderDoneStep()}
    </Dialog>
  );
};

export default DeleteAccountFlow;
