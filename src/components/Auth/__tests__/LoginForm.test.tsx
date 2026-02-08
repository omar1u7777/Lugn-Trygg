import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import LoginForm from '../LoginForm';

const apiMocks = vi.hoisted(() => ({
  loginUser: vi.fn(),
  api: { post: vi.fn() },
}));

const authMock = vi.hoisted(() => ({
  login: vi.fn(),
}));

const accessibilityMock = vi.hoisted(() => ({
  announceToScreenReader: vi.fn(),
}));

const lazyFirebaseBundleMock = vi.hoisted(() => ({
  loadFirebaseAuthBundle: vi.fn(() =>
    Promise.resolve({
      firebaseAuth: {},
      authModule: {
        GoogleAuthProvider: vi.fn(() => ({
          setCustomParameters: vi.fn(),
        })),
        signInWithPopup: vi.fn(),
        sendPasswordResetEmail: vi.fn(),
      },
    })
  ),
}));

vi.mock('../../../api/api', () => apiMocks);

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => authMock,
}));

vi.mock('../../../hooks/useAccessibility', () => ({
  useAccessibility: () => accessibilityMock,
}));

vi.mock('../../../services/lazyFirebase', () => lazyFirebaseBundleMock);

vi.mock('react-router-dom', () => ({
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.loginUser.mockReset();
    authMock.login.mockReset?.();
    accessibilityMock.announceToScreenReader.mockReset?.();
    lazyFirebaseBundleMock.loadFirebaseAuthBundle.mockClear();
  });

  it('renders login form with email and password fields', () => {
    render(<LoginForm />);

    expect(screen.getByPlaceholderText(/ange din e-postadress/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/ange ditt lösenord/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /logga in/i })).toBeInTheDocument();
  });

  it('calls login API and context on valid submission', async () => {
    apiMocks.loginUser.mockResolvedValue({
      access_token: 'mock-token',
      user_id: '123',
      email: 'test@example.com',
    });

    render(<LoginForm />);

    fireEvent.change(screen.getByPlaceholderText(/ange din e-postadress/i), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText(/ange ditt lösenord/i), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /logga in/i }));

    await waitFor(() => {
      expect(apiMocks.loginUser).toHaveBeenCalledWith('test@example.com', 'password123');
      expect(authMock.login).toHaveBeenCalledWith('mock-token', 'test@example.com', '123');
    });
  });

  it('shows loading indicator while submitting', async () => {
    let resolvePromise: ((value: unknown) => void) | null = null;
    apiMocks.loginUser.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePromise = resolve;
        })
    );

    render(<LoginForm />);

    fireEvent.change(screen.getByPlaceholderText(/ange din e-postadress/i), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText(/ange ditt lösenord/i), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /logga in/i }));

    expect(await screen.findByText(/loggar in/i)).toBeInTheDocument();

    resolvePromise?.({ access_token: 'token', user_id: 'user-1', email: 'test@example.com' });

    await waitFor(() => {
      expect(authMock.login).toHaveBeenCalled();
    });
  });

  it('shows error message when API call fails', async () => {
    apiMocks.loginUser.mockRejectedValue({
      response: { data: { error: 'Felaktiga uppgifter' } },
    });

    render(<LoginForm />);

    fireEvent.change(screen.getByPlaceholderText(/ange din e-postadress/i), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText(/ange ditt lösenord/i), {
      target: { value: 'wrongpassword' },
    });
    fireEvent.click(screen.getByRole('button', { name: /logga in/i }));

    await waitFor(() => {
      expect(screen.getByText(/felaktiga uppgifter/i)).toBeInTheDocument();
    });
  });
});
