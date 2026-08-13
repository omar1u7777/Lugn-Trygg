import { describe, it, expect } from 'vitest';
import { extractErrorMessage } from '../errorMessage';

const FALLBACK = 'Ett fel uppstod.';

const apiError = (data: unknown) => ({ response: { data } });

describe('extractErrorMessage', () => {
  describe('APIResponse shape', () => {
    // { error: <code>, message: <sentence> }
    it('uses message, not the machine code', () => {
      const error = apiError({
        success: false,
        error: 'SERVICE_UNAVAILABLE',
        message: 'Betaltjänsten är tillfälligt otillgänglig',
      });

      expect(extractErrorMessage(error, FALLBACK)).toBe('Betaltjänsten är tillfälligt otillgänglig');
    });

    it.each(['BAD_REQUEST', 'INTERNAL_ERROR', 'NOT_FOUND', 'VALIDATION_ERROR'])(
      'never shows the user %s',
      (code) => {
        const error = apiError({ error: code });
        expect(extractErrorMessage(error, FALLBACK)).toBe(FALLBACK);
      }
    );
  });

  describe('middleware shape', () => {
    // { error: <sentence> } — no message field at all.
    it.each([
      'CSRF-token saknas',
      'CSRF-token matchar inte',
      'Ogiltig CSRF-token',
      'Åtkomst nekad',
    ])('uses error when it is a sentence: %s', (text) => {
      expect(extractErrorMessage(apiError({ error: text }), FALLBACK)).toBe(text);
    });
  });

  describe('nothing usable', () => {
    it.each([
      ['no response at all', new Error('boom')],
      ['an empty body', apiError({})],
      ['a null body', apiError(null)],
      ['a string body', apiError('oops')],
      ['undefined', undefined],
      ['null', null],
      ['an empty message', apiError({ message: '   ' })],
    ])('falls back on %s', (_label, error) => {
      expect(extractErrorMessage(error, FALLBACK)).toBe(FALLBACK);
    });

    it('does not surface axios plumbing to the user', () => {
      // These are true but meaningless to someone trying to upgrade.
      expect(extractErrorMessage(new Error('Network Error'), FALLBACK)).toBe(FALLBACK);
      expect(extractErrorMessage(new Error('Request failed with status code 503'), FALLBACK)).toBe(FALLBACK);
    });
  });

  it('prefers message over error when both are sentences', () => {
    const error = apiError({ error: 'Något gick fel', message: 'Kunde inte spara dagboksinlägget' });
    expect(extractErrorMessage(error, FALLBACK)).toBe('Kunde inte spara dagboksinlägget');
  });

  it('falls through to error when message is itself a code', () => {
    // Defensive: some handlers put the code in both fields.
    const error = apiError({ error: 'Sessionen har gått ut', message: 'UNAUTHORIZED' });
    expect(extractErrorMessage(error, FALLBACK)).toBe('Sessionen har gått ut');
  });
});
