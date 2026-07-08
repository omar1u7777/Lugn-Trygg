import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import MemoryJournal from '../MemoryJournal';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
    i18n: { language: 'sv' },
  }),
}));

vi.mock('../../hooks/useAuth', () => ({
  default: () => ({
    user: { user_id: 'test-user-123', email: 'test@example.com' },
    token: 'test-token',
  }),
}));

vi.mock('../../services/analytics', () => ({
  analytics: { track: () => {}, identify: () => {}, page: () => {} },
}));

vi.mock('../../utils/logger', () => ({
  logger: { debug: () => {}, error: () => {}, warn: () => {}, info: () => {} },
}));

const mockPost = vi.fn();
const mockGet = vi.fn();
vi.mock('../../api/api', () => ({
  api: {
    post: (...args: unknown[]) => mockPost(...args),
    get: (...args: unknown[]) => mockGet(...args),
  },
}));

describe('BUG A: isSubmitting guard prevents duplicate submissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPost.mockImplementation(() =>
      new Promise((resolve) => setTimeout(() => resolve({ data: { id: 'mem_1' } }), 500))
    );
    mockGet.mockResolvedValue({ data: { data: { memories: [] } } });
  });

  test('double-click on submit does not create duplicate memories', async () => {
    render(
      <BrowserRouter>
        <MemoryJournal />
      </BrowserRouter>
    );

    // Type some content
    const textarea = screen.getByPlaceholderText(/Beskriv stunden/i);
    fireEvent.change(textarea, { target: { value: 'Ett testminne' } });

    // Find and double-click submit button
    const submitBtn = screen.getByRole('button', { name: /Spara Minne/i });
    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn);

    // Wait for any pending operations
    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledTimes(1);
    }, { timeout: 3000 });
  });
});
