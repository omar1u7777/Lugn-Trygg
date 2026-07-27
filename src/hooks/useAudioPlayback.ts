import { useCallback, useEffect, useRef } from 'react';
import { logger } from '../utils/logger';

export interface PlayAudioOptions {
  loop?: boolean;
  volume?: number;
  /** Fired when playback ends naturally (non-looping audio). */
  onEnded?: () => void;
  /** Fired when the element fails to load/play. */
  onError?: () => void;
}

export interface AudioPlayback {
  /** Load and start a new audio source, replacing any current one. */
  play: (url: string, options?: PlayAudioOptions) => void;
  /** Pause the current audio, keeping position. */
  pause: () => void;
  /** Resume the current audio from its position. */
  resume: () => void;
  /** Stop and release the current audio element. */
  stop: () => void;
}

/**
 * Single-owner HTMLAudioElement lifecycle.
 *
 * Replaces the duplicated `new Audio()` + ref pause/null bookkeeping across
 * wellness components. Guarantees at most one live element per hook instance
 * and releases it on unmount, so navigating away can never leave audio playing.
 */
export function useAudioPlayback(): AudioPlayback {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }, []);

  const play = useCallback((url: string, options: PlayAudioOptions = {}) => {
    stop();
    const audio = new Audio(url);
    audio.volume = options.volume ?? 0.6;
    audio.preload = 'auto';
    audio.loop = options.loop ?? false;
    if (options.onEnded) {
      audio.addEventListener('ended', options.onEnded);
    }
    if (options.onError) {
      audio.addEventListener('error', options.onError);
    }
    audioRef.current = audio;
    audio.play()?.catch((e) => {
      logger.error('Audio playback failed:', e);
      options.onError?.();
    });
  }, [stop]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const resume = useCallback(() => {
    audioRef.current?.play()?.catch((e) => logger.error('Audio resume failed:', e));
  }, []);

  useEffect(() => stop, [stop]);

  return { play, pause, resume, stop };
}

export default useAudioPlayback;
