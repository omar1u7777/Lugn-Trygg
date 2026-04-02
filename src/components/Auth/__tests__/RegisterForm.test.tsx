import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import RegisterForm from '../RegisterForm';

// Hoisted mocks
const registerUserMock = vi.hoisted(() => vi.fn());

const accessibilityMock = vi.hoisted(() => ({
  announceToScreenReader: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'registerForm.title': 'Skapa konto',
        'registerForm.nameLabel': 'Namn',
        'registerForm.namePlaceholder': 'Ange ditt namn',
        'registerForm.nameRequired': 'Namn är obligatoriskt.',
        'registerForm.emailLabel': 'E-postadress',
        'registerForm.emailPlaceholder': 'Ange din e-postadress',
        'registerForm.invalidEmail': 'Ange en giltig e-postadress.',
        'registerForm.passwordLabel': 'Lösenord',
        'registerForm.passwordPlaceholder': 'Skapa ett starkt lösenord',
        'registerForm.passwordHelp': 'Minst 8 tecken.',
        'registerForm.passwordTooShort': 'Lösenordet måste vara minst 8 tecken långt.',
        'registerForm.passwordNeedsChars': 'Lösenordet måste innehålla minst en stor bokstav, en liten bokstav och en siffra.',
        'registerForm.passwordNeedsSpecial': 'Lösenordet måste innehålla minst ett specialtecken.',
        'registerForm.showPassword': 'Visa lösenord',
        'registerForm.hidePassword': 'Dölj lösenord',
        'registerForm.confirmPasswordLabel': 'Bekräfta lösenord',
        'registerForm.confirmPasswordPlaceholder': 'Bekräfta ditt lösenord',
        'registerForm.passwordMismatch': 'Lösenorden matchar inte.',
        'registerForm.acceptTermsPrefix': 'Jag accepterar',
        'registerForm.termsLink': 'användarvillkoren',
        'registerForm.acceptPrivacyPrefix': 'Jag accepterar',
        'registerForm.privacyLink': 'integritetspolicyn',
        'registerForm.termsRequired': 'Du måste acceptera villkoren och integritetspolicyn.',
        'registerForm.creating': 'Skapar konto...',
        'registerForm.success': 'Registrering lyckades! Du kan nu logga in.',
        'registerForm.failedPrefix': 'Registrering misslyckades:',
        'registerForm.formErrors': 'Formuläret innehåller fel.',
        'registerForm.hasAccount': 'Har du redan ett konto?',
        'registerForm.loginLink': 'Logga in här',
        'registerForm.goToLogin': 'Gå till inloggningssidan',
        'registerForm.referralActive': 'Referenskod aktiv!',
        'registerForm.referralCode': 'Kod:',
      };
      return translations[key] || key;
    },
    i18n: { language: 'sv' },
  }),
}));

vi.mock('../../../api/api', () => ({
  registerUser: registerUserMock,
}));

vi.mock('../../../hooks/useAccessibility', () => ({
  useAccessibility: () => accessibilityMock,
}));

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

describe('RegisterForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const acceptRequiredConsents = () => {
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    checkboxes.forEach((checkbox) => {
      if (!checkbox.checked) {
        fireEvent.click(checkbox);
      }
    });
  };

  it('renders registration form with all fields', () => {
    render(<RegisterForm />);

    expect(screen.getByPlaceholderText(/ange ditt namn/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/ange din e-postadress/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/skapa ett starkt lösenord/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/bekräfta ditt lösenord/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /skapa konto/i })).toBeInTheDocument();
  });

  it('shows error when passwords do not match', async () => {
    render(<RegisterForm />);

    fireEvent.change(screen.getByPlaceholderText(/ange ditt namn/i), {
      target: { value: 'Test User' },
    });
    fireEvent.change(screen.getByPlaceholderText(/ange din e-postadress/i), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText(/skapa ett starkt lösenord/i), {
      target: { value: 'StrongPass1!' },
    });
    fireEvent.change(screen.getByPlaceholderText(/bekräfta ditt lösenord/i), {
      target: { value: 'DifferentPass2!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /skapa konto/i }));

    await waitFor(() => {
      expect(screen.getByText(/lösenorden matchar inte/i)).toBeInTheDocument();
    });
  });

  it('shows error for password shorter than 8 characters', async () => {
    render(<RegisterForm />);

    fireEvent.change(screen.getByPlaceholderText(/ange ditt namn/i), {
      target: { value: 'Test User' },
    });
    fireEvent.change(screen.getByPlaceholderText(/ange din e-postadress/i), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText(/skapa ett starkt lösenord/i), {
      target: { value: 'Ab1!' },
    });
    fireEvent.change(screen.getByPlaceholderText(/bekräfta ditt lösenord/i), {
      target: { value: 'Ab1!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /skapa konto/i }));

    await waitFor(() => {
      expect(screen.getByText(/lösenordet måste vara minst 8 tecken/i)).toBeInTheDocument();
    });
  });

  it('shows error for password missing uppercase, lowercase, or digit', async () => {
    render(<RegisterForm />);

    fireEvent.change(screen.getByPlaceholderText(/ange ditt namn/i), {
      target: { value: 'Test User' },
    });
    fireEvent.change(screen.getByPlaceholderText(/ange din e-postadress/i), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText(/skapa ett starkt lösenord/i), {
      target: { value: 'lowercase!' },
    });
    fireEvent.change(screen.getByPlaceholderText(/bekräfta ditt lösenord/i), {
      target: { value: 'lowercase!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /skapa konto/i }));

    await waitFor(() => {
      expect(screen.getByText(/lösenordet måste innehålla minst en stor bokstav/i)).toBeInTheDocument();
    });
  });

  it('shows error for password missing special character', async () => {
    render(<RegisterForm />);

    fireEvent.change(screen.getByPlaceholderText(/ange ditt namn/i), {
      target: { value: 'Test User' },
    });
    fireEvent.change(screen.getByPlaceholderText(/ange din e-postadress/i), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText(/skapa ett starkt lösenord/i), {
      target: { value: 'Abcdefg1' },
    });
    fireEvent.change(screen.getByPlaceholderText(/bekräfta ditt lösenord/i), {
      target: { value: 'Abcdefg1' },
    });
    fireEvent.click(screen.getByRole('button', { name: /skapa konto/i }));

    await waitFor(() => {
      expect(screen.getByText(/lösenordet måste innehålla minst ett specialtecken/i)).toBeInTheDocument();
    });
  });

  it('calls registerUser API on valid submission', async () => {
    registerUserMock.mockResolvedValue({
      user: { id: '123', email: 'test@example.com' },
    });

    render(<RegisterForm />);

    fireEvent.change(screen.getByPlaceholderText(/ange ditt namn/i), {
      target: { value: 'Test User' },
    });
    fireEvent.change(screen.getByPlaceholderText(/ange din e-postadress/i), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText(/skapa ett starkt lösenord/i), {
      target: { value: 'StrongPass1!' },
    });
    fireEvent.change(screen.getByPlaceholderText(/bekräfta ditt lösenord/i), {
      target: { value: 'StrongPass1!' },
    });
    acceptRequiredConsents();
    fireEvent.click(screen.getByRole('button', { name: /skapa konto/i }));

    await waitFor(() => {
      expect(registerUserMock).toHaveBeenCalledWith(
        'test@example.com',
        'StrongPass1!',
        'Test User',
        '',
        true,
        true
      );
    });
  });

  it('shows success message on successful registration', async () => {
    registerUserMock.mockResolvedValue({
      user: { id: '123', email: 'test@example.com' },
    });

    render(<RegisterForm />);

    fireEvent.change(screen.getByPlaceholderText(/ange ditt namn/i), {
      target: { value: 'Test User' },
    });
    fireEvent.change(screen.getByPlaceholderText(/ange din e-postadress/i), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText(/skapa ett starkt lösenord/i), {
      target: { value: 'StrongPass1!' },
    });
    fireEvent.change(screen.getByPlaceholderText(/bekräfta ditt lösenord/i), {
      target: { value: 'StrongPass1!' },
    });
    acceptRequiredConsents();
    fireEvent.click(screen.getByRole('button', { name: /skapa konto/i }));

    await waitFor(() => {
      expect(screen.getByText(/registrering lyckades/i)).toBeInTheDocument();
    });
  });

  it('shows error message on registration failure', async () => {
    registerUserMock.mockRejectedValue(
      new Error('E-postadressen är redan registrerad.')
    );

    render(<RegisterForm />);

    fireEvent.change(screen.getByPlaceholderText(/ange ditt namn/i), {
      target: { value: 'Test User' },
    });
    fireEvent.change(screen.getByPlaceholderText(/ange din e-postadress/i), {
      target: { value: 'existing@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText(/skapa ett starkt lösenord/i), {
      target: { value: 'StrongPass1!' },
    });
    fireEvent.change(screen.getByPlaceholderText(/bekräfta ditt lösenord/i), {
      target: { value: 'StrongPass1!' },
    });
    acceptRequiredConsents();
    fireEvent.click(screen.getByRole('button', { name: /skapa konto/i }));

    await waitFor(() => {
      expect(screen.getByText(/e-postadressen är redan registrerad/i)).toBeInTheDocument();
    });
  });
});
