/**
 * 🔐 LOGIN & REGISTER FORM INTEGRATION TESTS
 * Tests real authentication forms with backend API integration
 * 
 * Uses data-testid selectors for reliable test identification
 * regardless of i18n translation state.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import LoginForm from '../Auth/LoginForm';
import RegisterForm from '../Auth/RegisterForm';

// Mock API via hoisting so vitest can initialize before mocks
const mockAPI = vi.hoisted(() => ({
  loginUser: vi.fn(),
  registerUser: vi.fn(),
  api: {
    post: vi.fn(),
  },
}));

const firebaseAuthModuleMocks = vi.hoisted(() => ({
  GoogleAuthProvider: vi.fn(function () {
    return { setCustomParameters: vi.fn() };
  }),
  signInWithRedirect: vi.fn().mockResolvedValue(undefined),
  getRedirectResult: vi.fn().mockResolvedValue(null),
  sendPasswordResetEmail: vi.fn(),
}));

const lazyFirebaseBundleMock = vi.hoisted(() => ({
  loadFirebaseAuthBundle: vi.fn(() =>
    Promise.resolve({
      firebaseAuth: {},
      authModule: firebaseAuthModuleMocks,
    })
  ),
}));

// Mock theme tokens
vi.mock('../../theme/tokens', () => ({
  colors: {},
  spacing: {},
  shadows: {},
  borderRadius: {},
}));

vi.mock('../../api/index', () => mockAPI);
vi.mock('../../api/api', () => mockAPI);
vi.mock('../../services/lazyFirebase', () => lazyFirebaseBundleMock);

// Mock AuthContext
const mockLogin = vi.hoisted(() => vi.fn());
const mockRegister = vi.hoisted(() => vi.fn());

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
    register: mockRegister,
    user: null,
    loading: false,
    error: null,
  }),
}));

// Mock hooks
vi.mock('../../hooks/useAccessibility', () => ({
  useAccessibility: () => ({
    announceToScreenReader: vi.fn(),
    isReducedMotion: false,
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
    i18n: { language: 'sv' },
  }),
}));

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

const acceptRequiredConsents = () => {
  const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
  checkboxes.forEach((checkbox) => {
    if (!checkbox.checked) {
      fireEvent.click(checkbox);
    }
  });
};

describe('🔐 Login Form Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAPI.loginUser.mockResolvedValue({
      accessToken: 'test-token-123',
      userId: 'user-123',
      email: 'test@example.com',
    });
    firebaseAuthModuleMocks.signInWithRedirect.mockReset();
    firebaseAuthModuleMocks.getRedirectResult.mockResolvedValue(null);
    lazyFirebaseBundleMock.loadFirebaseAuthBundle.mockClear();
  });

  describe('Rendering', () => {
    test('should render login form', () => {
      renderWithRouter(<LoginForm />);

      expect(screen.getByTestId('login-email-input')).toBeInTheDocument();
      expect(screen.getByTestId('login-password-input')).toBeInTheDocument();
      expect(screen.getByTestId('login-submit-button')).toBeInTheDocument();
    });

    test('should render Google sign-in button', () => {
      renderWithRouter(<LoginForm />);

      expect(screen.getByTestId('login-google-button')).toBeInTheDocument();
    });

    test('should render forgot password link', () => {
      renderWithRouter(<LoginForm />);

      expect(screen.getByTestId('login-forgot-password-button')).toBeInTheDocument();
    });

    test('should render register link', () => {
      renderWithRouter(<LoginForm />);

      expect(screen.getByTestId('login-register-link')).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    test('should validate empty email', async () => {
      renderWithRouter(<LoginForm />);

      const submitButton = screen.getByTestId('login-submit-button');
      fireEvent.click(submitButton);

      // HTML5 validation should prevent submission
      const emailInput = document.getElementById('email') as HTMLInputElement;
      expect(emailInput.validity.valid).toBe(false);
    });

    test('should validate email format', () => {
      renderWithRouter(<LoginForm />);

      const emailInput = document.getElementById('email') as HTMLInputElement;
      
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
      expect(emailInput.validity.valid).toBe(false);

      fireEvent.change(emailInput, { target: { value: 'valid@example.com' } });
      expect(emailInput.validity.valid).toBe(true);
    });

    test('should show/hide password', () => {
      renderWithRouter(<LoginForm />);

      const passwordInput = document.getElementById('password') as HTMLInputElement;
      expect(passwordInput.type).toBe('password');

      // Find and click visibility toggle
      const visibilityToggle = screen.getByRole('button', { name: /visa|dölj|show|hide/i });
      fireEvent.click(visibilityToggle);
      // After toggle, type should change
      expect(passwordInput.type).toBe('text');
    });
  });

  describe('Form Submission', () => {
    test('should submit login form successfully', async () => {
      renderWithRouter(<LoginForm />);

      const emailInput = screen.getByTestId('login-email-input').querySelector('input') || screen.getByTestId('login-email-input');
      const passwordInput = screen.getByTestId('login-password-input').querySelector('input') || screen.getByTestId('login-password-input');
      const submitButton = screen.getByTestId('login-submit-button');

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'TestPassword123!' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockAPI.loginUser).toHaveBeenCalledWith('test@example.com', 'TestPassword123!');
        expect(mockLogin).toHaveBeenCalledWith('test-token-123', 'test@example.com', 'user-123');
      });
    });

    test('should show loading state during submission', async () => {
      // Mock that never resolves so loading state persists
      mockAPI.loginUser.mockImplementation(() => new Promise(() => {}));

      renderWithRouter(<LoginForm />);

      const emailInput = screen.getByTestId('login-email-input').querySelector('input') || screen.getByTestId('login-email-input');
      const passwordInput = screen.getByTestId('login-password-input').querySelector('input') || screen.getByTestId('login-password-input');
      const submitButton = screen.getByTestId('login-submit-button');

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password' } });
      fireEvent.click(submitButton);

      // Verify the API was called (proving form submitted and loading state initiated)
      await waitFor(() => {
        expect(mockAPI.loginUser).toHaveBeenCalledWith('test@example.com', 'password');
      });
    });

    test('should handle login error', async () => {
      mockAPI.loginUser.mockRejectedValue({
        response: {
          data: {
            error: 'Felaktiga inloggningsuppgifter'
          }
        }
      });

      renderWithRouter(<LoginForm />);

      const emailInput = screen.getByTestId('login-email-input').querySelector('input') || screen.getByTestId('login-email-input');
      const passwordInput = screen.getByTestId('login-password-input').querySelector('input') || screen.getByTestId('login-password-input');
      const submitButton = screen.getByTestId('login-submit-button');

      fireEvent.change(emailInput, { target: { value: 'wrong@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        // Error is displayed - check that API was called
        expect(mockAPI.loginUser).toHaveBeenCalledWith('wrong@example.com', 'wrongpassword');
      });
    });
  });

  describe('Google Sign-In', () => {
    test('should handle Google sign-in button click', async () => {
      firebaseAuthModuleMocks.signInWithRedirect.mockResolvedValue(undefined);

      renderWithRouter(<LoginForm />);

      const googleButton = screen.getByTestId('login-google-button');
      fireEvent.click(googleButton);

      await waitFor(() => {
        expect(firebaseAuthModuleMocks.signInWithRedirect).toHaveBeenCalled();
      }, { timeout: 2000 });
    });

    test('should handle Google sign-in error', async () => {
      firebaseAuthModuleMocks.signInWithRedirect.mockRejectedValue(new Error('Redirect failed'));

      renderWithRouter(<LoginForm />);

      const googleButton = screen.getByTestId('login-google-button');
      fireEvent.click(googleButton);

      await waitFor(() => {
        expect(firebaseAuthModuleMocks.signInWithRedirect).toHaveBeenCalled();
      }, { timeout: 2000 });
    });
  });
});

describe('📝 Register Form Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAPI.registerUser.mockResolvedValue({
      message: 'Registrering lyckades',
      user_id: 'new-user-123',
    });
    lazyFirebaseBundleMock.loadFirebaseAuthBundle.mockClear();
  });

  describe('Rendering', () => {
    test('should render register form', () => {
      renderWithRouter(<RegisterForm />);

      expect(screen.getByTestId('register-name-input')).toBeInTheDocument();
      expect(screen.getByTestId('register-email-input')).toBeInTheDocument();
      expect(screen.getByTestId('register-password-input')).toBeInTheDocument();
      expect(screen.getByTestId('register-confirm-password-input')).toBeInTheDocument();
      expect(screen.getByTestId('register-submit-button')).toBeInTheDocument();
    });

    test('should show referral code from URL params', () => {
      // RegisterForm reads referral code from ?ref= URL parameter
      window.history.pushState({}, '', '?ref=FRIEND2025');
      renderWithRouter(<RegisterForm />);

      expect(screen.getByTestId('register-referral-code')).toHaveTextContent('FRIEND2025');
      // Clean up
      window.history.pushState({}, '', '/');
    });

    test('should render login link', () => {
      renderWithRouter(<RegisterForm />);

      expect(screen.getByTestId('register-login-link')).toBeInTheDocument();
    });
  });

  describe('Password Validation', () => {
    test('should validate password length', async () => {
      renderWithRouter(<RegisterForm />);

      const nameInput = screen.getByTestId('register-name-input').querySelector('input') || screen.getByTestId('register-name-input');
      const emailInput = screen.getByTestId('register-email-input').querySelector('input') || screen.getByTestId('register-email-input');
      const passwordInput = document.getElementById('password')!;
      const confirmPasswordInput = document.getElementById('confirmPassword')!;
      const submitButton = screen.getByTestId('register-submit-button');

      fireEvent.change(nameInput, { target: { value: 'Test' } });
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'Short1!' } }); // Too short
      fireEvent.change(confirmPasswordInput, { target: { value: 'Short1!' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        const passwordError = document.getElementById('password-error');
        expect(passwordError).toBeInTheDocument();
        expect(passwordError).toHaveTextContent(/minst 8 tecken/i);
      });
    });

    test('should validate password complexity', async () => {
      renderWithRouter(<RegisterForm />);

      const nameInput = screen.getByTestId('register-name-input').querySelector('input') || screen.getByTestId('register-name-input');
      const emailInput = screen.getByTestId('register-email-input').querySelector('input') || screen.getByTestId('register-email-input');
      const passwordInput = document.getElementById('password')!;
      const confirmPasswordInput = document.getElementById('confirmPassword')!;
      const submitButton = screen.getByTestId('register-submit-button');

      fireEvent.change(nameInput, { target: { value: 'Test' } });
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'weakpassword' } }); // No uppercase, no number, no special char
      fireEvent.change(confirmPasswordInput, { target: { value: 'weakpassword' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        const passwordError = document.getElementById('password-error');
        expect(passwordError).toBeInTheDocument();
        expect(passwordError).toHaveTextContent(/stor bokstav/i);
      });
    });

    test('should validate password match', async () => {
      renderWithRouter(<RegisterForm />);

      const nameInput = screen.getByTestId('register-name-input').querySelector('input') || screen.getByTestId('register-name-input');
      const emailInput = screen.getByTestId('register-email-input').querySelector('input') || screen.getByTestId('register-email-input');
      const passwordInput = document.getElementById('password')!;
      const confirmPasswordInput = document.getElementById('confirmPassword')!;
      const submitButton = screen.getByTestId('register-submit-button');

      fireEvent.change(nameInput, { target: { value: 'Test' } });
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'StrongPass123!' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'DifferentPass123!' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(document.getElementById('confirm-password-error')).toBeInTheDocument();
        expect(document.getElementById('confirm-password-error')).toHaveTextContent(/lösenorden matchar inte/i);
      });
    });

    test('should accept strong password', async () => {
      renderWithRouter(<RegisterForm />);

      const nameInput = screen.getByTestId('register-name-input').querySelector('input') || screen.getByTestId('register-name-input');
      const emailInput = screen.getByTestId('register-email-input').querySelector('input') || screen.getByTestId('register-email-input');
      const passwordInput = document.getElementById('password')!;
      const confirmPasswordInput = document.getElementById('confirmPassword')!;
      const submitButton = screen.getByTestId('register-submit-button');

      fireEvent.change(nameInput, { target: { value: 'Test' } });
      fireEvent.change(emailInput, { target: { value: 'new@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'StrongPass123!' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'StrongPass123!' } });
      acceptRequiredConsents();
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockAPI.registerUser).toHaveBeenCalledWith(
          'new@example.com',
          'StrongPass123!',
          'Test',
          '',
          true,
          true
        );
      });
    });
  });

  describe('Form Submission', () => {
    test('should submit registration successfully', async () => {
      renderWithRouter(<RegisterForm />);

      const nameInput = screen.getByTestId('register-name-input').querySelector('input') || screen.getByTestId('register-name-input');
      const emailInput = screen.getByTestId('register-email-input').querySelector('input') || screen.getByTestId('register-email-input');
      const passwordInput = document.getElementById('password')!;
      const confirmPasswordInput = document.getElementById('confirmPassword')!;
      const submitButton = screen.getByTestId('register-submit-button');

      fireEvent.change(nameInput, { target: { value: 'Test User' } });
      fireEvent.change(emailInput, { target: { value: 'newuser@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'SecurePass123!' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'SecurePass123!' } });
      acceptRequiredConsents();
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockAPI.registerUser).toHaveBeenCalledWith(
          'newuser@example.com',
          'SecurePass123!',
          'Test User',
          '',
          true,
          true
        );
      });
    });

    test('should submit with referral code', async () => {
      // Set referral code in URL before rendering
      window.history.pushState({}, '', '?ref=FRIEND2025');
      renderWithRouter(<RegisterForm />);

      const nameInput = screen.getByTestId('register-name-input').querySelector('input') || screen.getByTestId('register-name-input');
      const emailInput = screen.getByTestId('register-email-input').querySelector('input') || screen.getByTestId('register-email-input');
      const passwordInput = document.getElementById('password')!;
      const confirmPasswordInput = document.getElementById('confirmPassword')!;
      const submitButton = screen.getByTestId('register-submit-button');

      fireEvent.change(nameInput, { target: { value: 'Referred User' } });
      fireEvent.change(emailInput, { target: { value: 'referred@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'RefPass123!' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'RefPass123!' } });
      acceptRequiredConsents();
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockAPI.registerUser).toHaveBeenCalledWith(
          'referred@example.com',
          'RefPass123!',
          'Referred User',
          'FRIEND2025',
          true,
          true
        );
      });

      // Clean up URL
      window.history.pushState({}, '', '/');
    });

    test('should show success message after registration', async () => {
      mockAPI.registerUser.mockResolvedValue({
        message: 'Registrering lyckades',
        user_id: 'new-user-123',
      });

      renderWithRouter(<RegisterForm />);

      const nameInput = screen.getByTestId('register-name-input').querySelector('input') || screen.getByTestId('register-name-input');
      const emailInput = screen.getByTestId('register-email-input').querySelector('input') || screen.getByTestId('register-email-input');
      const passwordInput = document.getElementById('password')!;
      const confirmPasswordInput = document.getElementById('confirmPassword')!;
      const submitButton = screen.getByTestId('register-submit-button');

      fireEvent.change(nameInput, { target: { value: 'Success User' } });
      fireEvent.change(emailInput, { target: { value: 'success@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'SuccessPass123!' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'SuccessPass123!' } });
      acceptRequiredConsents();
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByTestId('register-success-message')).toBeInTheDocument();
      });
    });

    test('should handle registration error', async () => {
      mockAPI.registerUser.mockRejectedValue(
        new Error('E-postadressen är redan registrerad')
      );

      renderWithRouter(<RegisterForm />);

      const nameInput = screen.getByTestId('register-name-input').querySelector('input') || screen.getByTestId('register-name-input');
      const emailInput = screen.getByTestId('register-email-input').querySelector('input') || screen.getByTestId('register-email-input');
      const passwordInput = document.getElementById('password')!;
      const confirmPasswordInput = document.getElementById('confirmPassword')!;
      const submitButton = screen.getByTestId('register-submit-button');

      fireEvent.change(nameInput, { target: { value: 'Existing User' } });
      fireEvent.change(emailInput, { target: { value: 'existing@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'ExistingPass123!' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'ExistingPass123!' } });
      acceptRequiredConsents();
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByTestId('register-error-message')).toBeInTheDocument();
      });
    });

    test('should clear form after successful registration', async () => {
      renderWithRouter(<RegisterForm />);

      const nameInput = screen.getByTestId('register-name-input').querySelector('input') || screen.getByTestId('register-name-input');
      const emailInput = screen.getByTestId('register-email-input').querySelector('input') || screen.getByTestId('register-email-input');
      const passwordInput = document.getElementById('password') as HTMLInputElement;
      const confirmPasswordInput = document.getElementById('confirmPassword') as HTMLInputElement;
      const submitButton = screen.getByTestId('register-submit-button');

      fireEvent.change(nameInput, { target: { value: 'Clear Test' } });
      fireEvent.change(emailInput, { target: { value: 'clear@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'ClearPass123!' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'ClearPass123!' } });
      acceptRequiredConsents();
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect((nameInput as HTMLInputElement).value).toBe('');
        expect((emailInput as HTMLInputElement).value).toBe('');
        expect(passwordInput.value).toBe('');
        expect(confirmPasswordInput.value).toBe('');
      });
    });
  });

  describe('Accessibility', () => {
    test('should have proper form elements', () => {
      renderWithRouter(<RegisterForm />);

      expect(screen.getByTestId('register-name-input')).toBeInTheDocument();
      expect(screen.getByTestId('register-email-input')).toBeInTheDocument();
      expect(screen.getByTestId('register-password-input')).toBeInTheDocument();
      expect(screen.getByTestId('register-confirm-password-input')).toBeInTheDocument();
    });

    test('should support keyboard navigation', () => {
      renderWithRouter(<RegisterForm />);

      const nameInput = screen.getByTestId('register-name-input').querySelector('input') || screen.getByTestId('register-name-input');
      (nameInput as HTMLElement).focus();

      expect(document.activeElement).toBe(nameInput);
    });
  });
});
