/**
 * Byte-array ↔ base64 helpers that survive large payloads.
 *
 * The obvious one-liner — `btoa(String.fromCharCode(...bytes))` — spreads one
 * argument per byte into a function call. Engines cap argument counts in the
 * low six figures, so it throws `RangeError: Maximum call stack size
 * exceeded` once the input passes roughly 64–125 kB. Both encryption paths in
 * this app used that form on whole ciphertexts, so encrypting a long voice
 * transcript or a multi-page journal entry threw instead of returning
 * ciphertext — losing the entry rather than storing it unencrypted.
 *
 * Chunking keeps every `String.fromCharCode` call well under the limit while
 * producing a byte-identical result, so previously stored values still decode.
 */

/** Well under every engine's argument limit, and a whole number of base64 triplets. */
const CHUNK_SIZE = 0x8000; // 32 768

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

/**
 * Returns `Uint8Array<ArrayBuffer>`, not the wider `Uint8Array<ArrayBufferLike>`
 * that a bare `Uint8Array` annotation means since TS 5.7. Callers pass the
 * result straight to `crypto.subtle.decrypt` as a `BufferSource`, which does
 * not accept the SharedArrayBuffer-inclusive form.
 */
export function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
