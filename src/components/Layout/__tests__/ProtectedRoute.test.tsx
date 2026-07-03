import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const authMock = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => authMock.useAuth(),
}));

vi.mock('../../WorldClassDashboardSkeleton', () => ({
  default: () => <div>Loading skeleton</div>,
}));

vi.mock('../../../utils/logger', () => ({
  logger: { debug: vi.fn(), warn: vi.fn() },
}));

import ProtectedRoute from '../ProtectedRoute';

const renderWithRouter = (initialPath: string = '/protected') => {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/protected" element={<ProtectedRoute><div>Protected Content</div></ProtectedRoute>} />
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/admin" element={<ProtectedRoute requireAdmin><div>Admin Content</div></ProtectedRoute>} />
      </Routes>
    </MemoryRouter>
  );
};

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state when not initialized', () => {
    authMock.useAuth.mockReturnValue({
      isLoggedIn: false,
      isInitialized: false,
      user: null,
    });

    renderWithRouter();
    expect(screen.getByText(/laddar/i)).toBeInTheDocument();
  });

  it('redirects to /login when not authenticated', () => {
    authMock.useAuth.mockReturnValue({
      isLoggedIn: false,
      isInitialized: true,
      user: null,
    });

    renderWithRouter();
    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('renders children when authenticated', () => {
    authMock.useAuth.mockReturnValue({
      isLoggedIn: true,
      isInitialized: true,
      user: { role: 'user', email: 'test@example.com' },
    });

    renderWithRouter();
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('shows access denied for non-admin when requireAdmin is true', () => {
    authMock.useAuth.mockReturnValue({
      isLoggedIn: true,
      isInitialized: true,
      user: { role: 'user', email: 'test@example.com' },
    });

    renderWithRouter('/admin');
    expect(screen.getByText(/ingen åtkomst/i)).toBeInTheDocument();
    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
  });

  it('renders admin content for admin user', () => {
    authMock.useAuth.mockReturnValue({
      isLoggedIn: true,
      isInitialized: true,
      user: { role: 'admin', email: 'admin@example.com' },
    });

    renderWithRouter('/admin');
    expect(screen.getByText('Admin Content')).toBeInTheDocument();
  });

  // Bug 9: ProtectedRoute preserves redirect location in navigation state
  it('preserves original location in redirect state', () => {
    authMock.useAuth.mockReturnValue({
      isLoggedIn: false,
      isInitialized: true,
      user: null,
    });

    // Use MemoryRouter with a location-aware approach
    let capturedLocation: any = null;
    const LocationCapture = () => {
      const { useLocation } = require('react-router-dom');
      capturedLocation = useLocation();
      return null;
    };

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/protected" element={<ProtectedRoute><div>Protected</div></ProtectedRoute>} />
          <Route path="/login" element={<><LocationCapture /><div>Login Page</div></>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Login Page')).toBeInTheDocument();
    // The login route should have received state.from with the original location
    expect(capturedLocation).not.toBeNull();
    expect(capturedLocation.state).not.toBeNull();
    expect(capturedLocation.state.from).not.toBeNull();
    expect(capturedLocation.state.from.pathname).toBe('/protected');
  });
});
