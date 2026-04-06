/**
 * ConsentModal Component Tests
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────
const { grantBulkConsentsMock, mapFrontendConsentsMock, navigateMock } = vi.hoisted(() => ({
  grantBulkConsentsMock: vi.fn().mockResolvedValue({}),
  mapFrontendConsentsMock: vi.fn((c: Record<string, boolean>) => c),
  navigateMock: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

// ─── Module mocks ─────────────────────────────────────────────────────────────
vi.mock('../../../api/consent', () => ({
  grantBulkConsents: grantBulkConsentsMock,
  mapFrontendConsentsToBackend: mapFrontendConsentsMock,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

vi.mock('../../../utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

// Mock UI components to avoid complex rendering
vi.mock('../../ui/tailwind/Dialog', () => ({
  Dialog: ({ open, children, onClose }: { open: boolean; children: React.ReactNode; onClose: () => void }) =>
    open ? <div data-testid="dialog" role="dialog">{children}</div> : null,
}));

vi.mock('../../ui/tailwind/Button', () => ({
  Button: ({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) => (
    <button onClick={onClick} disabled={disabled}>{children}</button>
  ),
}));

vi.mock('../../ui/tailwind/Feedback', () => ({
  Alert: ({ children, variant }: { children: React.ReactNode; variant: string }) => (
    <div role="alert" data-variant={variant}>{children}</div>
  ),
}));

// ─── Component import ─────────────────────────────────────────────────────────
import ConsentModal from '../ConsentModal';

const renderModal = (isOpen = true, onClose = vi.fn()) => {
  return render(
    <MemoryRouter>
      <ConsentModal isOpen={isOpen} onClose={onClose} />
    </MemoryRouter>
  );
};

describe('ConsentModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    grantBulkConsentsMock.mockResolvedValue({});
    mapFrontendConsentsMock.mockImplementation((c) => c);
  });

  it('renders when isOpen is true', () => {
    renderModal(true);
    expect(screen.getByTestId('dialog')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    renderModal(false);
    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
  });

  it('renders consent title', () => {
    renderModal();
    expect(screen.getByText('consent.title')).toBeInTheDocument();
  });

  it('renders consent checkboxes', () => {
    renderModal();
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThan(0);
  });

  it('allows toggling optional consent checkboxes', () => {
    renderModal();
    // Find all checkboxes and try toggling one
    const checkboxes = screen.getAllByRole('checkbox');
    const firstCheckbox = checkboxes[0];
    const initialChecked = firstCheckbox.checked;
    fireEvent.click(firstCheckbox);
    expect(firstCheckbox.checked).toBe(!initialChecked);
  });

  it('accept button is disabled when required consents not checked', () => {
    renderModal();
    const buttons = screen.getAllByRole('button');
    const submitBtn = buttons.find(b => b.textContent?.includes('consent.acceptAndContinue'));
    expect(submitBtn).toBeDisabled();
  });

  it('submits successfully when all required consents are checked', async () => {
    const onClose = vi.fn();
    renderModal(true, onClose);
    // Check all required checkboxes
    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach(cb => {
      if (!cb.checked) fireEvent.click(cb);
    });

    const buttons = screen.getAllByRole('button');
    const submitBtn = buttons.find(b => b.textContent?.includes('consent.accept'));
    if (submitBtn) {
      fireEvent.click(submitBtn);
      await waitFor(() => expect(grantBulkConsentsMock).toHaveBeenCalled());
      await waitFor(() => expect(onClose).toHaveBeenCalled());
    }
  });

  it('stores consent in localStorage on success', async () => {
    renderModal();
    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach(cb => { if (!cb.checked) fireEvent.click(cb); });

    const buttons = screen.getAllByRole('button');
    const submitBtn = buttons.find(b => b.textContent?.includes('consent.accept'));
    if (submitBtn) {
      fireEvent.click(submitBtn);
      await waitFor(() => expect(localStorage.getItem('consent_given')).toBe('true'));
    }
  });

  it('shows error when API call fails', async () => {
    grantBulkConsentsMock.mockRejectedValueOnce(new Error('Server error'));
    renderModal();
    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach(cb => { if (!cb.checked) fireEvent.click(cb); });

    const buttons = screen.getAllByRole('button');
    const submitBtn = buttons.find(b => b.textContent?.includes('consent.accept'));
    if (submitBtn) {
      fireEvent.click(submitBtn);
      await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    }
  });

  it('resets state when modal reopens', () => {
    const { rerender } = renderModal(false);
    rerender(
      <MemoryRouter>
        <ConsentModal isOpen={true} onClose={vi.fn()} />
      </MemoryRouter>
    );
    expect(screen.getByTestId('dialog')).toBeInTheDocument();
    // Error state should be cleared
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('uses backend error message from axios-style response errors', async () => {
    grantBulkConsentsMock.mockRejectedValueOnce({
      response: { data: { error: 'Backend denied consent' } },
    });

    renderModal();
    screen.getAllByRole('checkbox').forEach((cb) => {
      if (!cb.checked) fireEvent.click(cb);
    });

    const submitBtn = screen.getAllByRole('button').find((b) =>
      b.textContent?.includes('consent.accept')
    );

    expect(submitBtn).toBeDefined();
    fireEvent.click(submitBtn!);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Backend denied consent');
    });
  });

  it('falls back to translated save error for unknown non-error values', async () => {
    grantBulkConsentsMock.mockRejectedValueOnce({ foo: 'bar' });

    renderModal();
    screen.getAllByRole('checkbox').forEach((cb) => {
      if (!cb.checked) fireEvent.click(cb);
    });

    const submitBtn = screen.getAllByRole('button').find((b) =>
      b.textContent?.includes('consent.accept')
    );

    expect(submitBtn).toBeDefined();
    fireEvent.click(submitBtn!);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('consent.saveError');
    });
  });

  it('navigates home when cancel is clicked', () => {
    renderModal();
    fireEvent.click(screen.getByText('consent.cancel'));
    expect(navigateMock).toHaveBeenCalledWith('/');
  });
});
