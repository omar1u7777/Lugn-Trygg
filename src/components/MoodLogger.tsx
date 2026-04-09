/**
 * @deprecated Use SuperMoodLogger instead. This file is a backward-compatibility
 * shim that re-exports SuperMoodLogger. All mood logging is centralized in
 * SuperMoodLogger.tsx — do NOT add new logic here.
 */
import React from 'react';
import { SuperMoodLogger } from './SuperMoodLogger';

interface MoodLoggerProps {
  onMoodLogged?: () => void;
}

const MoodLogger: React.FC<MoodLoggerProps> = ({ onMoodLogged }) => {
  const handleMoodLogged = onMoodLogged
    ? (_mood?: number, _note?: string) => onMoodLogged()
    : undefined;

  return (
    <SuperMoodLogger
      showRecentMoods={true}
      enableVoiceRecording={false}
      {...(handleMoodLogged ? { onMoodLogged: handleMoodLogged } : {})}
    />
  );
};

export default MoodLogger;
