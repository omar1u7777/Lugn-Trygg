/**
 * ForgotPassword Component Tests
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────
const { sendPasswordResetEmailMock, loadFirebaseMock } = vi.hoisted(() => {
  const sendPasswordResetEmailMock = vi.fn().mockResolvedValue(undefined);
  const loadFirebaseMock = vi.fn().mockResolvedValue({
    firebaseAuth: {},
    authModule: { sendPasswordResetEmail: sendPasswordResetEmailMock },
  });
  return { sendPasswordResetEmailMock, loadFirebaseMock };
});

// ─── Module mocks ─────────────────────────────────────────────────────────────
vi.mock('../../../services/lazyFirebase', () => ({
  loadFirebaseAuthBundle: loadFirebaseMock,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

vi.mock('../../../hooks/useAccessibility', () => ({
  useAccessibility: () => ({
    announceToScreenReader: vi.fn(),
    getAriaLabel: vi.fn((a: string) => a),
  }),
}));

vi.mock('../../../utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

// Mock UI components
vi.mock('../../ui/tailwind/Dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
}));

vi.mock('../../ui/tailwind/Input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock('../../ui/tailwind/Button', () => ({
  Button: ({ children, fullWidth: _fullWidth, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode; fullWidth?: boolean }) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock('../../ui/tailwind/Feedback', () => ({
  Alert: ({ children, variant, role }: { children: React.ReactNode; variant: string; role?: string }) => (
    <div role={role || 'alert'} data-variant={variant}>{children}</div>
  ),
}));

// ─── Component import ─────────────────────────────────────────────────────────
import ForgotPassword from '../ForgotPassword';

const renderComponent = (onClose = vi.fn(), onSuccess = vi.fn()) =>
  render(<ForgotPassword onClose={onClose} onSuccess={onSuccess} />);

describe('ForgotPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendPasswordResetEmailMock.mockResolvedValue(undefined);
    loadFirebaseMock.mockResolvedValue({
      firebaseAuth: {},
      authModule: { sendPasswordResetEmail: sendPasswordResetEmailMock },
    });
  });

  it('renders the dialog', () => {
    renderComponent();
    expect(screen.getByTestId('dialog')).toBeInTheDocument();
  });

  it('renders the title', () => {
    renderComponent();
    expect(screen.getByText('forgotPassword.title')).toBeInTheDocument();
  });

  it('renders an email input', () => {
    renderComponent();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders a close button', () => {
    renderComponent();
    expect(screen.getByLabelText('forgotPassword.closeDialog')).toBeInTheDocument();
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    renderComponent(onClose);
    fireEvent.click(screen.getByLabelText('forgotPassword.closeDialog'));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows validation error for invalid email', async () => {
    renderComponent();
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'not-an-email' } });
    const form = input.closest('form')!;
    fireEvent.submit(form);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent('forgotPassword.invalidEmail');
  });

  it('submits with valid email and shows success message', async () => {
    renderComponent();
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'user@example.com' } });
    const form = input.closest('form')!;
    fireEvent.submit(form);
    await waitFor(() => expect(sendPasswordResetEmailMock).toHaveBeenCalledWith({}, 'user@example.com'));
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
  });

  it('shows success message for auth/user-not-found (security: no account reveal)', async () => {
    sendPasswordResetEmailMock.mockRejectedValueOnce({ code: 'auth/user-not-found' });
    renderComponent();
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'unknown@example.com' } });
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
  });

  it('shows error for auth/too-many-requests', async () => {
    sendPasswordResetEmailMock.mockRejectedValueOnce({ code: 'auth/too-many-requests' });
    renderComponent();
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'user@example.com' } });
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('forgotPassword.tooManyRequests'));
  });

  it('shows generic error for unknown Firebase errors', async () => {
    sendPasswordResetEmailMock.mockRejectedValueOnce({ code: 'auth/unknown-error' });
    renderComponent();
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'user@example.com' } });
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('forgotPassword.genericError'));
  });
});
