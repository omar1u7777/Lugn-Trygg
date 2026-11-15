/**
 * /wellness plays its audio from our own storage when one is configured.
 *
 * The addresses were hardcoded to upload.wikimedia.org. With
 * VITE_AUDIO_BASE_URL set to where the same files have been copied, each is
 * served from there by file name; unset, they are as before.
 */
import { describe, it, expect } from 'vitest';
import { resolveAudioUrl } from '../audioSource';

const SOURCE = 'https://upload.wikimedia.org/wikipedia/commons/3/38/Birds_forest.ogg';
const OWN = 'https://res.cloudinary.com/example/video/upload/lugn-trygg';

describe('resolveAudioUrl', () => {
  it('is the source address when no own storage is configured', () => {
    expect(resolveAudioUrl(SOURCE, undefined)).toBe(SOURCE);
    expect(resolveAudioUrl(SOURCE, '')).toBe(SOURCE);
  });

  it('is the same file in our own storage when one is configured', () => {
    expect(resolveAudioUrl(SOURCE, OWN)).toBe(`${OWN}/Birds_forest.ogg`);
    expect(resolveAudioUrl(SOURCE, `${OWN}/`)).toBe(`${OWN}/Birds_forest.ogg`);
  });

  it('ignores a base that is not an https address', () => {
    expect(resolveAudioUrl(SOURCE, 'http://insecure.example/audio')).toBe(SOURCE);
    expect(resolveAudioUrl(SOURCE, 'not a url')).toBe(SOURCE);
  });
});
