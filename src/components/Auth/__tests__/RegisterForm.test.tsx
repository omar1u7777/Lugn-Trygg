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
    // Honours the fallback argument, as i18next does. Without it any key
    // absent from the map below rendered as the key itself — which is how
    // the password checklist came out as "password.requirement.length".
    t: (key: string, fallback?: string | Record<string, unknown>) => {
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
      if (translations[key]) return translations[key];
      if (typeof fallback === 'string') return fallback;
      return key;
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

const navigateMock = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
  useNavigate: () => navigateMock,
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

describe('RegisterForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
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
    // Was a submit click. The button is disabled while the form is invalid, so
    // that click cannot happen any more — blur is where the message appears
    // now, which is earlier and cheaper for the user (BUG-38).
    fireEvent.blur(screen.getByPlaceholderText(/skapa ett starkt lösenord/i));
    fireEvent.blur(screen.getByPlaceholderText(/bekräfta ditt lösenord/i));

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
    // Was a submit click. The button is disabled while the form is invalid, so
    // that click cannot happen any more — blur is where the message appears
    // now, which is earlier and cheaper for the user (BUG-38).
    fireEvent.blur(screen.getByPlaceholderText(/skapa ett starkt lösenord/i));
    fireEvent.blur(screen.getByPlaceholderText(/bekräfta ditt lösenord/i));

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
    // Was a submit click. The button is disabled while the form is invalid, so
    // that click cannot happen any more — blur is where the message appears
    // now, which is earlier and cheaper for the user (BUG-38).
    fireEvent.blur(screen.getByPlaceholderText(/skapa ett starkt lösenord/i));
    fireEvent.blur(screen.getByPlaceholderText(/bekräfta ditt lösenord/i));

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
    // Was a submit click. The button is disabled while the form is invalid, so
    // that click cannot happen any more — blur is where the message appears
    // now, which is earlier and cheaper for the user (BUG-38).
    fireEvent.blur(screen.getByPlaceholderText(/skapa ett starkt lösenord/i));
    fireEvent.blur(screen.getByPlaceholderText(/bekräfta ditt lösenord/i));

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

  // Bug 11: RegisterForm redirects to /login after successful registration
  it('redirects to /login after successful registration', async () => {
    vi.useFakeTimers();
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

    await vi.advanceTimersByTimeAsync(2000);

    expect(navigateMock).toHaveBeenCalledWith('/login');
  });

  // Bug 12: extractErrorMessage handles response.data.error format
  it('extracts error message from response.data.error', async () => {
    registerUserMock.mockRejectedValue({
      response: { data: { error: 'Server error from API' } },
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
      expect(screen.getByText(/server error from api/i)).toBeInTheDocument();
    });
  });

  // Bug 12: extractErrorMessage handles timeout errors
  it('shows timeout error message from extractErrorMessage', async () => {
    registerUserMock.mockRejectedValue({ message: 'Request timeout ECONNABORTED' });

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
      expect(screen.getByText(/servern svarar inte/i)).toBeInTheDocument();
    });
  });

  // Bug 12: extractErrorMessage handles network errors
  it('shows network error message from extractErrorMessage', async () => {
    registerUserMock.mockRejectedValue({ message: 'Network Error' });

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
      expect(screen.getByText(/kunde inte ansluta/i)).toBeInTheDocument();
    });
  });
});

/**
 * BUG-38 — "Skapa konto" reported disabled=false through an entirely empty
 * form, an e-mail reading "not-an-email", a password of "abc", an unconfirmed
 * password and unticked consent boxes.
 *
 * Every rule already existed in this component. They all ran after submit,
 * which turns a fixable typo into a round trip and a generic server error.
 *
 * Tying `disabled` to validity has a consequence worth stating: the submit
 * handler's messages become unreachable, because the click that produced them
 * cannot happen. They surface on blur now instead — the four existing tests
 * above were rewritten for that, and they assert the same strings.
 */
describe('BUG-38: the submit button reflects the form', () => {
  const submitButton = () => screen.getByTestId('register-submit-button');

  const fill = (placeholder: RegExp, value: string) =>
    fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value } });

  const fillValidForm = () => {
    fill(/ange ditt namn/i, 'Test User');
    fill(/ange din e-postadress/i, 'test@example.com');
    fill(/skapa ett starkt lösenord/i, 'Str0ng!Pass');
    fill(/bekräfta ditt lösenord/i, 'Str0ng!Pass');
    (screen.getAllByRole('checkbox') as HTMLInputElement[]).forEach((box) => {
      if (!box.checked) fireEvent.click(box);
    });
  };

  it('is disabled on an empty form', () => {
    render(<RegisterForm />);
    expect(submitButton()).toBeDisabled();
  });

  it.each([
    ['an invalid e-mail', () => fill(/ange din e-postadress/i, 'not-an-email')],
    ['a weak password', () => fill(/skapa ett starkt lösenord/i, 'abc')],
    ['an unconfirmed password', () => fill(/bekräfta ditt lösenord/i, 'something-else')],
  ])('stays disabled with %s', (_label, breakIt) => {
    render(<RegisterForm />);
    fillValidForm();
    expect(submitButton()).not.toBeDisabled();

    breakIt();

    expect(submitButton()).toBeDisabled();
  });

  it('stays disabled while consent is unticked', () => {
    // The pointed one: the button offered to create an account against terms
    // the user had not agreed to.
    render(<RegisterForm />);
    fill(/ange ditt namn/i, 'Test User');
    fill(/ange din e-postadress/i, 'test@example.com');
    fill(/skapa ett starkt lösenord/i, 'Str0ng!Pass');
    fill(/bekräfta ditt lösenord/i, 'Str0ng!Pass');

    expect(submitButton()).toBeDisabled();
  });

  it('enables only once everything holds', () => {
    render(<RegisterForm />);
    fillValidForm();
    expect(submitButton()).not.toBeDisabled();
  });
});

describe('BUG-38: the requirements are shown as they are met', () => {
  it('shows no checklist before there is a password', () => {
    render(<RegisterForm />);
    // Matched against the checklist's own label, not the help text — the help
    // text says "Minst 8 tecken" and is always present, which is precisely the
    // problem: it listed the rules and never said which ones were satisfied.
    expect(screen.queryByText(/8\+ tecken/i)).not.toBeInTheDocument();
  });

  it('shows the checklist once the user starts typing', () => {
    render(<RegisterForm />);
    fireEvent.change(screen.getByPlaceholderText(/skapa ett starkt lösenord/i), {
      target: { value: 'abc' },
    });
    expect(screen.getByText(/8\+ tecken/i)).toBeInTheDocument();
  });
});
