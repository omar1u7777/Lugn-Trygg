import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, test, expect } from 'vitest';
import LoginForm from '../LoginForm';

// Mock the API
vi.mock('../../../api/api', () => ({
  loginUser: vi.fn(),
}));

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

describe('LoginForm', () => {
  test('renders login form with email and password fields', () => {
    render(<LoginForm />);

    expect(screen.getByPlaceholderText(/ange din e-postadress/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/ange ditt lösenord/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /logga in/i })).toBeInTheDocument();
  });

  test('shows validation errors for empty fields', async () => {
    render(<LoginForm />);

    const submitButton = screen.getByRole('button', { name: /logga in/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/e-postadress krävs/i)).toBeInTheDocument();
    });
  });

  test('shows validation error for invalid email', async () => {
    render(<LoginForm />);

    const emailInput = screen.getByPlaceholderText(/ange din e-postadress/i);
    const submitButton = screen.getByRole('button', { name: /logga in/i });

    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/ogiltig e-postadress/i)).toBeInTheDocument();
    });
  });

  test('calls login API on valid form submission', async () => {
    const mockLoginUser = vi.fn().mockResolvedValue({
      access_token: 'mock-token',
      user_id: '123',
      email: 'test@example.com'
    });

    vi.mocked(require('../../../api/api').loginUser).mockImplementation(mockLoginUser);

    render(<LoginForm />);

    const emailInput = screen.getByPlaceholderText(/ange din e-postadress/i);
    const passwordInput = screen.getByPlaceholderText(/ange ditt lösenord/i);
    const submitButton = screen.getByRole('button', { name: /logga in/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockLoginUser).toHaveBeenCalledWith('test@example.com', 'password123');
    });
  });

  test('shows error message on login failure', async () => {
    const mockLoginUser = vi.fn().mockRejectedValue({
      response: { data: { error: 'Felaktiga uppgifter' } }
    });

    vi.mocked(require('../../../api/api').loginUser).mockImplementation(mockLoginUser);

    render(<LoginForm />);

    const emailInput = screen.getByPlaceholderText(/ange din e-postadress/i);
    const passwordInput = screen.getByPlaceholderText(/ange ditt lösenord/i);
    const submitButton = screen.getByRole('button', { name: /logga in/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/felaktiga uppgifter/i)).toBeInTheDocument();
    });
  });
});