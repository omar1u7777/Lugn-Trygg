/**
 * Where an audio file is played from.
 *
 * Audio is listed by its source address on Wikimedia Commons. With
 * VITE_AUDIO_BASE_URL set to an https address where the same files have been
 * copied (flat, under their own file names), a file is played from there
 * instead. The backend applies the same rule to the sound library through
 * AUDIO_BASE_URL. Anything that is not an https address is ignored.
 */
const configuredBase = (): string | undefined => import.meta.env.VITE_AUDIO_BASE_URL as string | undefined;

const httpsBase = (base: string | undefined): string | null => {
  const trimmed = (base ?? '').trim().replace(/\/+$/, '');
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' && parsed.host ? trimmed : null;
  } catch {
    return null;
  }
};

export const resolveAudioUrl = (sourceUrl: string, base: string | undefined = configuredBase()): string => {
  const own = httpsBase(base);
  if (!own) return sourceUrl;
  return `${own}/${sourceUrl.slice(sourceUrl.lastIndexOf('/') + 1)}`;
};
