import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, test, expect } from 'vitest';
import RegisterForm from '../RegisterForm';

// Mock the API
vi.mock('../../../api/api', () => ({
  registerUser: vi.fn(),
}));

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

describe('RegisterForm', () => {
  test('renders registration form with required fields', () => {
    render(<RegisterForm />);

    expect(screen.getByPlaceholderText(/ange din e-postadress/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/skapa ett starkt lösenord/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/bekräfta ditt lösenord/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /skapa konto/i })).toBeInTheDocument();
  });

  test('shows validation errors for empty fields', async () => {
    render(<RegisterForm />);

    const submitButton = screen.getByRole('button', { name: /skapa konto/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/e-postadress krävs/i)).toBeInTheDocument();
    });
  });

  test('shows validation error for invalid email', async () => {
    render(<RegisterForm />);

    const emailInput = screen.getByPlaceholderText(/ange din e-postadress/i);
    const submitButton = screen.getByRole('button', { name: /skapa konto/i });

    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/ogiltig e-postadress/i)).toBeInTheDocument();
    });
  });

  test('shows validation error when passwords do not match', async () => {
    render(<RegisterForm />);

    const emailInput = screen.getByPlaceholderText(/ange din e-postadress/i);
    const passwordInput = screen.getByPlaceholderText(/skapa ett starkt lösenord/i);
    const confirmPasswordInput = screen.getByPlaceholderText(/bekräfta ditt lösenord/i);
    const submitButton = screen.getByRole('button', { name: /skapa konto/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'differentpassword' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/lösenorden matchar inte/i)).toBeInTheDocument();
    });
  });

  test('calls register API on valid form submission', async () => {
    const mockRegisterUser = vi.fn().mockResolvedValue({
      message: 'Registrering lyckades!'
    });

    vi.mocked(require('../../../api/api').registerUser).mockImplementation(mockRegisterUser);

    render(<RegisterForm />);

    const emailInput = screen.getByPlaceholderText(/ange din e-postadress/i);
    const passwordInput = screen.getByPlaceholderText(/skapa ett starkt lösenord/i);
    const confirmPasswordInput = screen.getByPlaceholderText(/bekräfta ditt lösenord/i);
    const submitButton = screen.getByRole('button', { name: /skapa konto/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockRegisterUser).toHaveBeenCalledWith('test@example.com', 'password123');
    });
  });

  test('shows error message on registration failure', async () => {
    const mockRegisterUser = vi.fn().mockRejectedValue({
      response: { data: { error: 'E-postadressen är redan registrerad.' } }
    });

    vi.mocked(require('../../../api/api').registerUser).mockImplementation(mockRegisterUser);

    render(<RegisterForm />);

    const emailInput = screen.getByPlaceholderText(/ange din e-postadress/i);
    const passwordInput = screen.getByPlaceholderText(/skapa ett starkt lösenord/i);
    const confirmPasswordInput = screen.getByPlaceholderText(/bekräfta ditt lösenord/i);
    const submitButton = screen.getByRole('button', { name: /skapa konto/i });

    fireEvent.change(emailInput, { target: { value: 'existing@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/e-postadressen är redan registrerad/i)).toBeInTheDocument();
    });
  });
});