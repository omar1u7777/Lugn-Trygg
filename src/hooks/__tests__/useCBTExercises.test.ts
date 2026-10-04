import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const cbt = vi.hoisted(() => ({
  getCBTModules: vi.fn().mockResolvedValue([]),
  getPersonalizedSession: vi.fn().mockResolvedValue(null),
  getCBTInsights: vi.fn().mockResolvedValue(null),
  getCBTExercises: vi.fn().mockResolvedValue([]),
  updateCBTProgress: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../api/cbt', () => cbt);
// A stable t, as react-i18next provides: the hook's effect depends on it.
const i18n = vi.hoisted(() => ({ t: (key: string, fallback?: string) => fallback ?? key }));
vi.mock('react-i18next', () => ({ useTranslation: () => i18n }));

import { useCBTExercises } from '../useCBTExercises';

describe('useCBTExercises', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads CBT data when enabled', async () => {
    renderHook(() => useCBTExercises({ userId: 'u1', announce: vi.fn() }));
    await waitFor(() => expect(cbt.getCBTModules).toHaveBeenCalledTimes(1));
    expect(cbt.getPersonalizedSession).toHaveBeenCalledTimes(1);
    expect(cbt.getCBTInsights).toHaveBeenCalledTimes(1);
    expect(cbt.getCBTExercises).toHaveBeenCalledTimes(1);
  });

  it('makes no requests when disabled, as on the compact dashboard panel', async () => {
    const { result } = renderHook(() =>
      useCBTExercises({ userId: 'u1', announce: vi.fn(), enabled: false }));
    await new Promise((r) => setTimeout(r, 0));
    expect(cbt.getCBTModules).not.toHaveBeenCalled();
    expect(cbt.getPersonalizedSession).not.toHaveBeenCalled();
    expect(cbt.getCBTInsights).not.toHaveBeenCalled();
    expect(cbt.getCBTExercises).not.toHaveBeenCalled();
    expect(result.current.cbtLoading).toBe(false);
  });
});
