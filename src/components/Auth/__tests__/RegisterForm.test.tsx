import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import RegisterForm from '../RegisterForm';

// Hoisted mocks
const registerUserMock = vi.hoisted(() => vi.fn());

vi.mock('../../../api/api', () => ({
  registerUser: registerUserMock,
}));

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

describe('RegisterForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
    fireEvent.click(screen.getByRole('button', { name: /skapa konto/i }));

    await waitFor(() => {
      expect(registerUserMock).toHaveBeenCalledWith(
        'test@example.com',
        'StrongPass1!',
        'Test User',
        ''
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
    fireEvent.click(screen.getByRole('button', { name: /skapa konto/i }));

    await waitFor(() => {
      expect(screen.getByText(/e-postadressen är redan registrerad/i)).toBeInTheDocument();
    });
  });
});
