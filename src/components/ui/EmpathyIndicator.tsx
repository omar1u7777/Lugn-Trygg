import React, { useState } from 'react';
import { 
  FaceSmileIcon,
  FaceFrownIcon,
  HeartIcon,
  HandThumbUpIcon,
  HandThumbDownIcon
} from '@heroicons/react/24/outline';
import { analytics } from '../../services/analytics';

interface EmpathyIndicatorProps {
  sentiment?: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'crisis';
  emotions?: string[];
  messageId: string;
  onReaction?: (type: string) => void;
}

const EmpathyIndicator: React.FC<EmpathyIndicatorProps> = ({
  sentiment,
  emotions = [],
  messageId,
  onReaction
}) => {
  const [selectedReaction, setSelectedReaction] = useState<string | null>(null);
  const [showReactions, setShowReactions] = useState(false);

  const getSentimentIcon = () => {
    switch (sentiment) {
      case 'POSITIVE':
        return <FaceSmileIcon className="w-3 h-3" />;
      case 'NEGATIVE':
        return <FaceFrownIcon className="w-3 h-3" />;
      case 'crisis':
        return <HeartIcon className="w-3 h-3 text-red-500" />;
      default:
        return null;
    }
  };

  const getSentimentColor = () => {
    switch (sentiment) {
      case 'POSITIVE':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
      case 'NEGATIVE':
        return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300';
      case 'crisis':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
      default:
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
    }
  };

  const handleReaction = (type: string) => {
    setSelectedReaction(type);
    onReaction?.(type);
    
    // Track reaction for analytics
    analytics.track('AI Chat Reaction', {
      messageId,
      reaction: type,
      sentiment
    });

    // Hide reactions after selection
    setTimeout(() => setShowReactions(false), 2000);
  };

  const reactions = [
    { type: 'helpful', icon: <HandThumbUpIcon className="w-4 h-4" />, label: 'Hjälpsamt' },
    { type: 'not_helpful', icon: <HandThumbDownIcon className="w-4 h-4" />, label: 'Ej hjälpsamt' },
    { type: 'empathetic', icon: <HeartIcon className="w-4 h-4" />, label: 'Empatiskt' }
  ];

  return (
    <div className="mt-3 space-y-2">
      {/* Sentiment badge */}
      {sentiment && (
        <div className="flex items-center gap-2">
          <span className={`
            inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full transition-all
            ${getSentimentColor()}
          `}>
            {getSentimentIcon()}
            {sentiment === 'crisis' ? 'Kris upptäckt' : 
             sentiment === 'POSITIVE' ? 'Positivt' :
             sentiment === 'NEGATIVE' ? 'Negativt' : 'Neutralt'}
          </span>
          
          {/* Emotions */}
          {emotions.map((emotion, index) => (
            <span 
              key={index}
              className="text-xs text-gray-500 dark:text-gray-400 capitalize animate-fade-in"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {emotion}
            </span>
          ))}
        </div>
      )}

      {/* Reaction buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowReactions(!showReactions)}
          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          Var detta hjälpsamt?
        </button>

        {showReactions && (
          <div className="flex gap-1 animate-fade-in">
            {reactions.map((reaction) => (
              <button
                key={reaction.type}
                onClick={() => handleReaction(reaction.type)}
                className={`
                  p-1.5 rounded-full transition-all transform hover:scale-110
                  ${selectedReaction === reaction.type
                    ? 'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400'
                  }
                `}
                title={reaction.label}
              >
                {reaction.icon}
              </button>
            ))}
          </div>
        )}

        {selectedReaction && (
          <span className="text-xs text-teal-600 dark:text-teal-400 animate-fade-in">
            Tack för din feedback! 💫
          </span>
        )}
      </div>

      {/* Crisis support */}
      {sentiment === 'crisis' && (
        <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg animate-fade-in">
          <p className="text-xs text-red-700 dark:text-red-300">
            🚨 Vi har upptäckt att du kan behöva omedelbart stöd. 
            <a href="#" className="underline font-medium ml-1">
              Få hjälp nu
            </a>
          </p>
        </div>
      )}
    </div>
  );
};

export default EmpathyIndicator;
