import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, f?: string) => f ?? k }) }));
vi.mock('../../api/notifications', () => ({
  getNotificationSettings: vi.fn().mockResolvedValue({}),
  updateNotificationSettings: vi.fn().mockResolvedValue({}),
}));
vi.mock('../../services/notifications', () => ({ initializeMessaging: vi.fn() }));
vi.mock('../../utils/logger', () => ({ logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { useNotificationSettings } from '../useNotificationSettings';
import { updateNotificationSettings } from '../../api/notifications';

describe('useNotificationSettings', () => {
  it('lets the time picker change the reminder time without saving it', async () => {
    // The reminder modal called setNotificationSettings, which this hook
    // never returned: changing the time threw a ReferenceError and took the
    // recommendations page down with it.
    const { result } = renderHook(() => useNotificationSettings({ userId: 'u1', announce: vi.fn() }));
    await waitFor(() => expect(result.current.notificationSettings.reminderTime).toBe('09:00'));

    act(() => result.current.setReminderTime('20:30'));

    expect(result.current.notificationSettings.reminderTime).toBe('20:30');
    expect(updateNotificationSettings).not.toHaveBeenCalled();
  });
});
