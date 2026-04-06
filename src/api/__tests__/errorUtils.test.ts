/**
 * Tests for getApiErrorMessage utility.
 */
import axios, { AxiosError } from 'axios';
import { describe, it, expect } from 'vitest';
import { getApiErrorMessage } from '../errorUtils';

function makeAxiosError(
  responseData?: unknown,
  message = 'Request failed'
): AxiosError {
  const err = new AxiosError(message);
  if (responseData !== undefined) {
    err.response = {
      status: 400,
      statusText: 'Bad Request',
      data: responseData,
      headers: {},
      config: {} as AxiosError['config'],
    } as AxiosError['response'];
  }
  return err;
}

describe('getApiErrorMessage', () => {
  it('returns data.error when AxiosError has response with error field', () => {
    const err = makeAxiosError({ error: 'Validation failed' });
    expect(getApiErrorMessage(err, 'fallback')).toBe('Validation failed');
  });

  it('returns data.message when AxiosError has response with message field', () => {
    const err = makeAxiosError({ message: 'Bad credentials' });
    expect(getApiErrorMessage(err, 'fallback')).toBe('Bad credentials');
  });

  it('prefers data.error over data.message', () => {
    const err = makeAxiosError({ error: 'error field', message: 'message field' });
    expect(getApiErrorMessage(err, 'fallback')).toBe('error field');
  });

  it('returns fallback when AxiosError data is object without useful fields', () => {
    const err = makeAxiosError({});
    expect(getApiErrorMessage(err, 'fallback')).toBe('fallback');
  });

  it('returns axios error message when response data is non-object (string)', () => {
    const err = makeAxiosError('plain string');
    // data is not an object so falls to error.message
    expect(getApiErrorMessage(err, 'fallback')).toBe(err.message);
  });

  it('returns axios error message when no response', () => {
    const err = makeAxiosError(undefined, 'Network error');
    expect(getApiErrorMessage(err, 'fallback')).toBe('Network error');
  });

  it('returns plain Error message for generic Error', () => {
    const err = new Error('Something broke');
    expect(getApiErrorMessage(err, 'fallback')).toBe('Something broke');
  });

  it('returns fallback for null', () => {
    expect(getApiErrorMessage(null, 'fallback')).toBe('fallback');
  });

  it('returns fallback for undefined', () => {
    expect(getApiErrorMessage(undefined, 'fallback')).toBe('fallback');
  });

  it('returns fallback for unknown string value', () => {
    expect(getApiErrorMessage('some string error', 'fallback')).toBe('fallback');
  });

  it('returns fallback for Error with empty message', () => {
    const err = new Error('');
    expect(getApiErrorMessage(err, 'fallback')).toBe('fallback');
  });

  it('uses correct fallback text', () => {
    expect(getApiErrorMessage(42, 'custom fallback')).toBe('custom fallback');
  });
});
