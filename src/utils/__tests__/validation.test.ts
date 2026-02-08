import { describe, it, expect } from 'vitest';
import { validateEmail, validatePassword, validateConfirmPassword } from '../validation';

describe('Validation Utils', () => {
  describe('validateEmail', () => {
    it('should return true for valid email addresses', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('user.name+tag@example.co.uk')).toBe(true);
      expect(validateEmail('test123@example.se')).toBe(true);
      expect(validateEmail('åäö@example.com')).toBe(true);
    });

    it('should return false for invalid email addresses', () => {
      expect(validateEmail('')).toBe(false);
      expect(validateEmail('invalid-email')).toBe(false);
      expect(validateEmail('@example.com')).toBe(false);
      expect(validateEmail('test@')).toBe(false);
      expect(validateEmail('test.example.com')).toBe(false);
      expect(validateEmail('test@.com')).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('should return true for passwords with 8 or more characters', () => {
      expect(validatePassword('password')).toBe(true);
      expect(validatePassword('12345678')).toBe(true);
      expect(validatePassword('p@ssw0rd')).toBe(true);
      expect(validatePassword('verylongpassword123')).toBe(true);
    });

    it('should return false for passwords with less than 8 characters', () => {
      expect(validatePassword('')).toBe(false);
      expect(validatePassword('123')).toBe(false);
      expect(validatePassword('pass')).toBe(false);
      expect(validatePassword('1234567')).toBe(false);
    });
  });

  describe('validateConfirmPassword', () => {
    it('should return true when passwords match', () => {
      expect(validateConfirmPassword('password123', 'password123')).toBe(true);
      expect(validateConfirmPassword('12345678', '12345678')).toBe(true);
      expect(validateConfirmPassword('', '')).toBe(true);
    });

    it('should return false when passwords do not match', () => {
      expect(validateConfirmPassword('password123', 'password124')).toBe(false);
      expect(validateConfirmPassword('12345678', '87654321')).toBe(false);
      expect(validateConfirmPassword('password', '')).toBe(false);
      expect(validateConfirmPassword('', 'password')).toBe(false);
    });
  });
});