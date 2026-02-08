/**
 * Achievement Sharing Component - FULLY MIGRATED TO TAILWIND
 * Share milestones and achievements with friends and community
 */

import React, { useState } from 'react'
import { Alert, Button, Card } from './ui/tailwind';
import { ShareIcon, LinkIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { trackEvent } from '../services/analytics';

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  date: Date;
  category: 'streak' | 'milestone' | 'badge' | 'challenge';
}

interface AchievementSharingProps {
  achievement: Achievement;
  userId: string;
  onClose: () => void;
}

export const AchievementSharing: React.FC<AchievementSharingProps> = ({
  achievement,
  userId,
  onClose,
}) => {
  const { t } = useTranslation();
  const [shareMessage, setShareMessage] = useState(
    `I just earned "${achievement.title}" on Lugn & Trygg! 🎉`
  );
  const [shareAnonymously, setShareAnonymously] = useState(true);
  const [linkCopied, setLinkCopied] = useState(false);

  const generateShareableImage = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 630;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      // Background gradient
      const gradient = ctx.createLinearGradient(0, 0, 1200, 630);
      gradient.addColorStop(0, '#667eea');
      gradient.addColorStop(1, '#764ba2');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 1200, 630);
      
      // Achievement icon
      ctx.font = '120px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(achievement.icon, 600, 250);
      
      // Achievement title
      ctx.fillStyle = 'white';
      ctx.font = 'bold 48px Arial';
      ctx.fillText(achievement.title, 600, 380);
      
      // Description
      ctx.font = '32px Arial';
      ctx.fillText(achievement.description, 600, 450);
      
      // App name
      ctx.font = '24px Arial';
      ctx.fillText('Lugn & Trygg', 600, 550);
    }
    
    return canvas.toDataURL('image/png');
  };

  const handleShareToFacebook = () => {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://lugn-trygg.app/achievements/' + achievement.id)}`;
    window.open(url, '_blank', 'width=600,height=400');
    
    trackEvent('achievement_shared', {
      method: 'facebook',
      achievement_id: achievement.id,
      user_id: userId,
      anonymous: shareAnonymously,
    });
  };

  const handleShareToTwitter = () => {
    const text = shareAnonymously
      ? shareMessage
      : `${shareMessage} #LugnTrygg #MentalWellness`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'width=600,height=400');
    
    trackEvent('achievement_shared', {
      method: 'twitter',
      achievement_id: achievement.id,
      anonymous: shareAnonymously,
    });
  };

  const handleCopyLink = async () => {
    const link = `https://lugn-trygg.app/achievements/${achievement.id}`;
    
    try {
      await navigator.clipboard.writeText(link);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 3000);
      
      trackEvent('achievement_link_copied', {
        achievement_id: achievement.id,
      });
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };

  const handleDownloadImage = () => {
    const imageDataUrl = generateShareableImage();
    const link = document.createElement('a');
    link.download = `${achievement.title.replace(/\s+/g, '-')}-achievement.png`;
    link.href = imageDataUrl;
    link.click();
    
    trackEvent('achievement_image_downloaded', {
      achievement_id: achievement.id,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <ShareIcon className="w-7 h-7 text-primary" />
              {t('achievements.share.title', 'Share Achievement')}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              aria-label={t('common.close', 'Close')}
            >
              ✕
            </button>
          </div>

          {/* Achievement Preview */}
          <Card className="mb-6 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border-2 border-purple-200 dark:border-purple-700">
            <div className="p-6 text-center">
              <div className="text-6xl mb-4">{achievement.icon}</div>
              <h3 className="text-2xl font-bold mb-2">{achievement.title}</h3>
              <p className="text-base text-gray-600 dark:text-gray-300">{achievement.description}</p>
            </div>
          </Card>

          {/* Share Message */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">
              {t('achievements.share.message', 'Share Message')}
            </label>
            <textarea
              value={shareMessage}
              onChange={(e) => setShareMessage(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-800 min-h-[100px]"
              placeholder={t('achievements.share.messagePlaceholder', 'Write your share message...')}
            />
          </div>

          {/* Privacy Toggle */}
          <div className="mb-6 flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <input
              type="checkbox"
              id="share-anonymously"
              checked={shareAnonymously}
              onChange={(e) => setShareAnonymously(e.target.checked)}
              className="w-5 h-5 text-primary rounded focus:ring-2 focus:ring-primary"
            />
            <label htmlFor="share-anonymously" className="text-sm font-medium flex-1">
              {t('achievements.share.anonymous', 'Share anonymously (hide personal info)')}
            </label>
          </div>

          {linkCopied && (
            <Alert variant="success" className="mb-4">
              {t('achievements.share.linkCopied', 'Link copied to clipboard!')}
            </Alert>
          )}

          {/* Share Options */}
          <div className="space-y-3 mb-6">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              {t('achievements.share.methods', 'Share via')}
            </p>

            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={handleShareToFacebook}
                variant="outline"
                className="flex items-center justify-center gap-2"
              >
                <span className="text-xl">📘</span>
                Facebook
              </Button>

              <Button
                onClick={handleShareToTwitter}
                variant="outline"
                className="flex items-center justify-center gap-2"
              >
                <span className="text-xl">🐦</span>
                Twitter
              </Button>

              <Button
                onClick={handleCopyLink}
                variant="outline"
                className="flex items-center justify-center gap-2"
              >
                <LinkIcon className="w-5 h-5" />
                {t('achievements.share.copyLink', 'Copy Link')}
              </Button>

              <Button
                onClick={handleDownloadImage}
                variant="outline"
                className="flex items-center justify-center gap-2"
              >
                <ArrowDownTrayIcon className="w-5 h-5" />
                {t('achievements.share.downloadImage', 'Download Image')}
              </Button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end">
            <Button onClick={onClose} variant="secondary">
              {t('common.close', 'Close')}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

// Share Button Component
interface ShareButtonProps {
  achievement: Achievement;
  userId: string;
}

export const AchievementShareButton: React.FC<ShareButtonProps> = ({
  achievement,
  userId,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button 
        onClick={() => setOpen(true)} 
        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" 
        aria-label="Share achievement"
      >
        <ShareIcon className="w-5 h-5" />
      </button>
      {open && (
        <AchievementSharing
          achievement={achievement}
          userId={userId}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
};

export default AchievementSharing;
