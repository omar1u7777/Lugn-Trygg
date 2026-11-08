/**
 * The name a person gave, never one guessed from their e-mail address.
 *
 * The dashboard greeting, the account menu and /profile split the e-mail at
 * "@", dropped digits and capitalised the rest: "omaralhaek97@gmail.com"
 * became "Omaralhaek". Registration asks for a name and login returns it.
 */
import { describe, it, expect } from 'vitest';
import { getUserName } from '../nameUtils';

describe('getUserName', () => {
  it('returns the stored name', () => {
    expect(getUserName({ name: 'Omar Alhaek' })).toBe('Omar Alhaek');
  });

  it('prefers a display name the person chose', () => {
    expect(getUserName({ name: 'Omar Ahmad Alhaek', displayName: 'Omar' })).toBe('Omar');
  });

  it('trims whitespace', () => {
    expect(getUserName({ name: '  Anna  ' })).toBe('Anna');
  });

  it.each([undefined, null, '', '   '])('has no name for %j', (name) => {
    expect(getUserName({ name: name as string | undefined })).toBeNull();
  });

  // The login endpoint sends "Okänd" when no name is stored.
  it.each(['Okänd', 'okänd', 'Unknown', 'Användare'])('treats the placeholder %s as no name', (name) => {
    expect(getUserName({ name })).toBeNull();
  });

  it('never derives a name from the e-mail address', () => {
    expect(getUserName({ email: 'omaralhaek97@gmail.com' } as never)).toBeNull();
  });

  it('accepts no user', () => {
    expect(getUserName(null)).toBeNull();
    expect(getUserName(undefined)).toBeNull();
  });
});
