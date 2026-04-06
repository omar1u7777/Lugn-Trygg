import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../../utils/logger', () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { useDebouncedSave } from '../useDebouncedSave';

describe('useDebouncedSave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('returns initial state', () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useDebouncedSave({ name: 'Alice' }, { onSave, delay: 500 })
    );
    expect(result.current.data).toEqual({ name: 'Alice' });
    expect(result.current.isSaving).toBe(false);
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it('updates data on updateData call', () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useDebouncedSave({ count: 0 }, { onSave })
    );
    act(() => {
      result.current.updateData({ count: 1 });
    });
    expect(result.current.data).toEqual({ count: 1 });
    expect(result.current.hasUnsavedChanges).toBe(true);
  });

  it('saves after delay has elapsed', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useDebouncedSave({ value: 'initial' }, { onSave, delay: 1000 })
    );

    act(() => {
      result.current.updateData({ value: 'updated' });
    });

    expect(onSave).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });

    expect(onSave).toHaveBeenCalledWith({ value: 'updated' });
  });

  it('debounces multiple rapid updates (only saves last)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useDebouncedSave({ value: 'a' }, { onSave, delay: 500 })
    );

    act(() => {
      result.current.updateData({ value: 'b' });
      result.current.updateData({ value: 'c' });
      result.current.updateData({ value: 'd' });
    });

    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({ value: 'd' });
  });

  it('saveNow triggers immediate save without waiting for delay', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useDebouncedSave({ v: 0 }, { onSave, delay: 5000 })
    );

    act(() => {
      result.current.updateData({ v: 42 });
    });

    await act(async () => {
      await result.current.saveNow();
    });

    expect(onSave).toHaveBeenCalledWith({ v: 42 });
  });

  it('saveNow does nothing when no pending save', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useDebouncedSave({ v: 0 }, { onSave })
    );

    await act(async () => {
      await result.current.saveNow();
    });

    expect(onSave).not.toHaveBeenCalled();
  });

  it('cancelSave prevents pending save from firing', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useDebouncedSave({ v: 0 }, { onSave, delay: 500 })
    );

    act(() => {
      result.current.updateData({ v: 99 });
      result.current.cancelSave();
    });

    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });

    expect(onSave).not.toHaveBeenCalled();
  });

  it('revert restores to last saved state', () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useDebouncedSave({ name: 'initial' }, { onSave })
    );

    act(() => {
      result.current.updateData({ name: 'modified' });
      result.current.revert();
    });

    expect(result.current.data).toEqual({ name: 'initial' });
  });

  it('calls onSuccess callback after save', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onSuccess = vi.fn();
    const { result } = renderHook(() =>
      useDebouncedSave({ x: 1 }, { onSave, onSuccess, delay: 100 })
    );

    act(() => {
      result.current.updateData({ x: 2 });
    });

    await act(async () => {
      vi.advanceTimersByTime(100);
      await Promise.resolve();
    });

    expect(onSuccess).toHaveBeenCalledWith({ x: 2 });
  });

  it('calls onError callback when save fails', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('Save failed'));
    const onError = vi.fn();
    const { result } = renderHook(() =>
      useDebouncedSave({ x: 1 }, { onSave, onError, delay: 100 })
    );

    act(() => {
      result.current.updateData({ x: 5 });
    });

    await act(async () => {
      vi.advanceTimersByTime(100);
      await Promise.resolve();
    });

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it('handles updateData with function updater', () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useDebouncedSave({ count: 5 }, { onSave })
    );

    act(() => {
      result.current.updateData((prev) => ({ ...prev, count: prev.count + 1 }));
    });

    expect(result.current.data.count).toBe(6);
  });

  it('hasUnsavedChanges is false after successful saveNow', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useDebouncedSave({ v: 0 }, { onSave, delay: 100 })
    );

    act(() => {
      result.current.updateData({ v: 1 });
    });

    expect(result.current.hasUnsavedChanges).toBe(true);

    await act(async () => {
      await result.current.saveNow();
    });

    expect(result.current.hasUnsavedChanges).toBe(false);
  });
});
