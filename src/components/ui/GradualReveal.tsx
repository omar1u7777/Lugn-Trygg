import React, { useState, useEffect, useRef } from 'react';
import { SparklesIcon } from '@heroicons/react/24/outline';

interface GradualRevealProps {
  text: string;
  speed?: number; // ms per character
  className?: string;
  onComplete?: () => void;
  showCursor?: boolean;
}

const GradualReveal: React.FC<GradualRevealProps> = ({
  text,
  speed = 30,
  className = '',
  onComplete,
  showCursor = true
}) => {
  const [revealedText, setRevealedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setRevealedText('');
    setIsComplete(false);

    if (!text) return;

    let currentIndex = 0;
    
    intervalRef.current = setInterval(() => {
      if (currentIndex < text.length) {
        // Handle word boundaries for better reading
        const nextChar = text[currentIndex];
        const isSpace = nextChar === ' ';
        const isPunctuation = ['.', '!', '?', ','].includes(nextChar);
        
        setRevealedText(prev => prev + nextChar);
        currentIndex++;
        
        // Pause slightly at punctuation and spaces
        if (isSpace || isPunctuation) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = setInterval(() => {
              // Continue with next character
              if (currentIndex < text.length) {
                setRevealedText(prev => prev + text[currentIndex]);
                currentIndex++;
              }
            }, speed * 2);
          }
        }
      } else {
        // Complete
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        setIsComplete(true);
        onComplete?.();
      }
    }, speed);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [text, speed, onComplete]);

  return (
    <div className={`relative ${className}`}>
      <span className="whitespace-pre-wrap">{revealedText}</span>
      {showCursor && !isComplete && (
        <span className="inline-block w-0.5 h-5 bg-teal-500 animate-pulse ml-0.5" />
      )}
      
      {/* Sparkle effect when complete */}
      {isComplete && (
        <div className="absolute -top-2 -right-2 animate-fade-in-up">
          <SparklesIcon className="w-4 h-4 text-teal-500 animate-pulse" />
        </div>
      )}
    </div>
  );
};

export default GradualReveal;
