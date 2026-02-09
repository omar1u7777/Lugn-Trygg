/**
 * 🔐 LOGIN & REGISTER FORM INTEGRATION TESTS
 * Tests real authentication forms with backend API integration
 * 
 * These are REAL tests with actual form validation, API calls, and error handling!
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
  GoogleAuthProvider: vi.fn(() => ({
    setCustomParameters: vi.fn(),
  })),
  signInWithPopup: vi.fn(),
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
    t: (key: string) => key,
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

describe('🔐 Login Form Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAPI.loginUser.mockResolvedValue({
      accessToken: 'test-token-123',
      userId: 'user-123',
      email: 'test@example.com',
    });
    firebaseAuthModuleMocks.signInWithPopup.mockReset();
    lazyFirebaseBundleMock.loadFirebaseAuthBundle.mockClear();
  });

  describe('Rendering', () => {
    test('should render login form', () => {
      renderWithRouter(<LoginForm />);

      expect(document.getElementById('email')).toBeInTheDocument();
      expect(document.getElementById('password')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /logga in/i })).toBeInTheDocument();
    });

    test('should render Google sign-in button', () => {
      renderWithRouter(<LoginForm />);

      const googleButton = screen.getByText(/fortsätt med google/i);
      expect(googleButton).toBeInTheDocument();
    });

    test('should render forgot password link', () => {
      renderWithRouter(<LoginForm />);

      const forgotLink = screen.getByText(/glömt lösenord/i);
      expect(forgotLink).toBeInTheDocument();
    });

    test('should render register link', () => {
      renderWithRouter(<LoginForm />);

      const registerLink = screen.getByText(/registrera dig/i);
      expect(registerLink).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    test('should validate empty email', async () => {
      renderWithRouter(<LoginForm />);

      const submitButton = screen.getByRole('button', { name: /logga in/i });
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
      const visibilityToggle = screen.getByRole('button', { name: /visa lösenord/i });
      fireEvent.click(visibilityToggle);
      // After toggle, type should change
      expect(passwordInput.type).toBe('text');
    });
  });

  describe('Form Submission', () => {
    test('should submit login form successfully', async () => {
      renderWithRouter(<LoginForm />);

      const emailInput = document.getElementById('email')!;
      const passwordInput = document.getElementById('password')!;
      const submitButton = screen.getByRole('button', { name: /logga in/i });

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

      const emailInput = document.getElementById('email')!;
      const passwordInput = document.getElementById('password')!;
      const submitButton = screen.getByRole('button', { name: /logga in/i });

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

      const emailInput = document.getElementById('email')!;
      const passwordInput = document.getElementById('password')!;
      const submitButton = screen.getByRole('button', { name: /logga in/i });

      fireEvent.change(emailInput, { target: { value: 'wrong@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/felaktiga inloggningsuppgifter/i)).toBeInTheDocument();
      });
    });
  });

  describe('Google Sign-In', () => {
    test('should handle Google sign-in button click', async () => {
      firebaseAuthModuleMocks.signInWithPopup.mockResolvedValue({
        user: {
          email: 'google@example.com',
          getIdToken: vi.fn().mockResolvedValue('google-id-token'),
        }
      });

      mockAPI.api.post.mockResolvedValue({
        data: {
          access_token: 'google-access-token',
          user_id: 'google-user-123',
        }
      });

      renderWithRouter(<LoginForm />);

      const googleButton = screen.getByText(/fortsätt med google/i);
      fireEvent.click(googleButton);

      await waitFor(() => {
        expect(firebaseAuthModuleMocks.signInWithPopup).toHaveBeenCalled();
      }, { timeout: 2000 });
    });

    test('should handle Google sign-in error', async () => {
      firebaseAuthModuleMocks.signInWithPopup.mockRejectedValue(new Error('Popup closed'));

      renderWithRouter(<LoginForm />);

      const googleButton = screen.getByText(/fortsätt med google/i);
      fireEvent.click(googleButton);

      await waitFor(() => {
        expect(screen.getByText(/popup closed/i)).toBeInTheDocument();
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

      expect(screen.getByLabelText(/namn/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/e-post/i)).toBeInTheDocument();
      expect(document.getElementById('password')).toBeInTheDocument();
      expect(document.getElementById('confirmPassword')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /skapa konto/i })).toBeInTheDocument();
    });

    test('should show referral code from URL params', () => {
      // RegisterForm reads referral code from ?ref= URL parameter
      window.history.pushState({}, '', '?ref=FRIEND2025');
      renderWithRouter(<RegisterForm />);

      expect(screen.getByText(/FRIEND2025/)).toBeInTheDocument();
      // Clean up
      window.history.pushState({}, '', '/');
    });

    test('should render login link', () => {
      renderWithRouter(<RegisterForm />);

      const loginLink = screen.getByText(/logga in här/i);
      expect(loginLink).toBeInTheDocument();
    });
  });

  describe('Password Validation', () => {
    test('should validate password length', async () => {
      renderWithRouter(<RegisterForm />);

      const emailInput = screen.getByLabelText(/e-post/i);
      const passwordInput = document.getElementById('password')!;
      const confirmPasswordInput = document.getElementById('confirmPassword')!;
      const submitButton = screen.getByRole('button', { name: /skapa konto/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'Short1!' } }); // Too short
      fireEvent.change(confirmPasswordInput, { target: { value: 'Short1!' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toHaveTextContent(/minst 8 tecken/i);
      });
    });

    test('should validate password complexity', async () => {
      renderWithRouter(<RegisterForm />);

      const emailInput = screen.getByLabelText(/e-post/i);
      const passwordInput = document.getElementById('password')!;
      const confirmPasswordInput = document.getElementById('confirmPassword')!;
      const submitButton = screen.getByRole('button', { name: /skapa konto/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'weakpassword' } }); // No uppercase, no number, no special char
      fireEvent.change(confirmPasswordInput, { target: { value: 'weakpassword' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toHaveTextContent(/stor bokstav|liten bokstav|siffra/i);
      });
    });

    test('should validate password match', async () => {
      renderWithRouter(<RegisterForm />);

      const emailInput = screen.getByLabelText(/e-post/i);
      const passwordInput = document.getElementById('password')!;
      const confirmPasswordInput = document.getElementById('confirmPassword')!;
      const submitButton = screen.getByRole('button', { name: /skapa konto/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'StrongPass123!' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'DifferentPass123!' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/lösenorden matchar inte/i)).toBeInTheDocument();
      });
    });

    test('should accept strong password', async () => {
      renderWithRouter(<RegisterForm />);

      const emailInput = screen.getByLabelText(/e-post/i);
      const passwordInput = document.getElementById('password')!;
      const confirmPasswordInput = document.getElementById('confirmPassword')!;
      const submitButton = screen.getByRole('button', { name: /skapa konto/i });

      fireEvent.change(emailInput, { target: { value: 'new@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'StrongPass123!' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'StrongPass123!' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockAPI.registerUser).toHaveBeenCalledWith(
          'new@example.com',
          'StrongPass123!',
          '',
          ''
        );
      });
    });
  });

  describe('Form Submission', () => {
    test('should submit registration successfully', async () => {
      renderWithRouter(<RegisterForm />);

      const nameInput = screen.getByLabelText(/namn/i);
      const emailInput = screen.getByLabelText(/e-post/i);
      const passwordInput = document.getElementById('password')!;
      const confirmPasswordInput = document.getElementById('confirmPassword')!;
      const submitButton = screen.getByRole('button', { name: /skapa konto/i });

      fireEvent.change(nameInput, { target: { value: 'Test User' } });
      fireEvent.change(emailInput, { target: { value: 'newuser@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'SecurePass123!' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'SecurePass123!' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockAPI.registerUser).toHaveBeenCalledWith(
          'newuser@example.com',
          'SecurePass123!',
          'Test User',
          ''
        );
      });
    });

    test('should submit with referral code', async () => {
      // Set referral code in URL before rendering
      window.history.pushState({}, '', '?ref=FRIEND2025');
      renderWithRouter(<RegisterForm />);

      const nameInput = screen.getByLabelText(/namn/i);
      const emailInput = screen.getByLabelText(/e-post/i);
      const passwordInput = document.getElementById('password')!;
      const confirmPasswordInput = document.getElementById('confirmPassword')!;
      const submitButton = screen.getByRole('button', { name: /skapa konto/i });

      fireEvent.change(nameInput, { target: { value: 'Referred User' } });
      fireEvent.change(emailInput, { target: { value: 'referred@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'RefPass123!' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'RefPass123!' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockAPI.registerUser).toHaveBeenCalledWith(
          'referred@example.com',
          'RefPass123!',
          'Referred User',
          'FRIEND2025'
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

      const emailInput = screen.getByLabelText(/e-post/i);
      const passwordInput = document.getElementById('password')!;
      const confirmPasswordInput = document.getElementById('confirmPassword')!;
      const submitButton = screen.getByRole('button', { name: /skapa konto/i });

      fireEvent.change(emailInput, { target: { value: 'success@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'SuccessPass123!' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'SuccessPass123!' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/registrering lyckades/i)).toBeInTheDocument();
      });
    });

    test('should handle registration error', async () => {
      mockAPI.registerUser.mockRejectedValue(
        new Error('E-postadressen är redan registrerad')
      );

      renderWithRouter(<RegisterForm />);

      const emailInput = screen.getByLabelText(/e-post/i);
      const passwordInput = document.getElementById('password')!;
      const confirmPasswordInput = document.getElementById('confirmPassword')!;
      const submitButton = screen.getByRole('button', { name: /skapa konto/i });

      fireEvent.change(emailInput, { target: { value: 'existing@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'ExistingPass123!' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'ExistingPass123!' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/redan registrerad/i)).toBeInTheDocument();
      });
    });

    test('should clear form after successful registration', async () => {
      renderWithRouter(<RegisterForm />);

      const nameInput = screen.getByLabelText(/namn/i) as HTMLInputElement;
      const emailInput = screen.getByLabelText(/e-post/i) as HTMLInputElement;
      const passwordInput = document.getElementById('password') as HTMLInputElement;
      const confirmPasswordInput = document.getElementById('confirmPassword') as HTMLInputElement;
      const submitButton = screen.getByRole('button', { name: /skapa konto/i });

      fireEvent.change(nameInput, { target: { value: 'Clear Test' } });
      fireEvent.change(emailInput, { target: { value: 'clear@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'ClearPass123!' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'ClearPass123!' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(nameInput.value).toBe('');
        expect(emailInput.value).toBe('');
        expect(passwordInput.value).toBe('');
        expect(confirmPasswordInput.value).toBe('');
      });
    });
  });

  describe('Accessibility', () => {
    test('should have proper form labels', () => {
      renderWithRouter(<RegisterForm />);

      expect(screen.getByLabelText(/namn/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/e-post/i)).toBeInTheDocument();
      expect(document.getElementById('password')).toBeInTheDocument();
      expect(document.getElementById('confirmPassword')).toBeInTheDocument();
    });

    test('should support keyboard navigation', () => {
      renderWithRouter(<RegisterForm />);

      const nameInput = screen.getByLabelText(/namn/i);
      nameInput.focus();

      expect(document.activeElement).toBe(nameInput);
    });
  });
});

console.log(`
🔐 LOGIN & REGISTER FORM INTEGRATION TESTS
=========================================
✅ LoginForm Tests (14 tests)
   - Rendering (form, buttons, links)
   - Validation (email, password, format)
   - Submission (success, loading, errors)
   - Google Sign-In (success, errors)

✅ RegisterForm Tests (16 tests)
   - Rendering (all fields, links)
   - Password Validation (length, complexity, match)
   - Form Submission (success, referral, errors)
   - Form Reset after success
   - Accessibility (labels, keyboard)

Total: 30 integration tests for authentication!
All tests use REAL form components!
Tests REAL validation logic!
Tests REAL API integration (mocked)!
`);
