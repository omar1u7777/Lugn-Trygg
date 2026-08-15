import { describe, it, expect } from 'vitest';
import { base64ToBytes, bytesToBase64 } from '../base64';

/**
 * The previous implementation was `btoa(String.fromCharCode(...bytes))`, which
 * spreads one argument per byte and throws RangeError past roughly 64–125 kB.
 * Both encryption paths used it on whole ciphertexts, so encrypting a long
 * voice transcript threw instead of returning ciphertext — losing the entry.
 */
describe('base64 helpers', () => {
  it('matches btoa/atob for small inputs, so existing stored values still decode', () => {
    const bytes = new Uint8Array([0, 1, 2, 127, 128, 254, 255]);
    const legacy = btoa(String.fromCharCode(...bytes));

    expect(bytesToBase64(bytes)).toBe(legacy);
    expect(Array.from(base64ToBytes(legacy))).toEqual(Array.from(bytes));
  });

  it('round-trips a payload far larger than the argument-spread limit', () => {
    // 512 kB — comfortably past the point where the spread form throws.
    const large = new Uint8Array(512 * 1024);
    for (let i = 0; i < large.length; i += 1) {
      large[i] = i % 256;
    }

    const encoded = bytesToBase64(large);
    const decoded = base64ToBytes(encoded);

    expect(decoded.length).toBe(large.length);
    expect(decoded[0]).toBe(large[0]);
    expect(decoded[large.length - 1]).toBe(large[large.length - 1]);
    expect(decoded).toEqual(large);
  });

  it('demonstrates the old spread form actually throws at this size', () => {
    const large = new Uint8Array(512 * 1024);
    expect(() => String.fromCharCode(...large)).toThrow(RangeError);
  });

  it('handles the empty array', () => {
    expect(bytesToBase64(new Uint8Array())).toBe('');
    expect(base64ToBytes('').length).toBe(0);
  });
});
