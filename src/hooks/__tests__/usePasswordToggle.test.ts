import { renderHook, act } from '@testing-library/react';
import { usePasswordToggle, useMultiplePasswordToggle } from '../usePasswordToggle';

describe('usePasswordToggle', () => {
  it('defaults to hidden (showPassword = false)', () => {
    const { result } = renderHook(() => usePasswordToggle());
    expect(result.current.showPassword).toBe(false);
  });

  it('respects initialState = true', () => {
    const { result } = renderHook(() => usePasswordToggle(true));
    expect(result.current.showPassword).toBe(true);
  });

  it('togglePassword flips state', () => {
    const { result } = renderHook(() => usePasswordToggle());
    expect(result.current.showPassword).toBe(false);

    act(() => result.current.togglePassword());
    expect(result.current.showPassword).toBe(true);

    act(() => result.current.togglePassword());
    expect(result.current.showPassword).toBe(false);
  });

  it('setShowPassword allows manual control', () => {
    const { result } = renderHook(() => usePasswordToggle());

    act(() => result.current.setShowPassword(true));
    expect(result.current.showPassword).toBe(true);

    act(() => result.current.setShowPassword(false));
    expect(result.current.showPassword).toBe(false);
  });
});

describe('useMultiplePasswordToggle', () => {
  it('both fields start hidden', () => {
    const { result } = renderHook(() => useMultiplePasswordToggle());
    expect(result.current.showPassword).toBe(false);
    expect(result.current.showConfirmPassword).toBe(false);
  });

  it('toggles are independent', () => {
    const { result } = renderHook(() => useMultiplePasswordToggle());

    act(() => result.current.togglePassword());
    expect(result.current.showPassword).toBe(true);
    expect(result.current.showConfirmPassword).toBe(false);

    act(() => result.current.toggleConfirmPassword());
    expect(result.current.showPassword).toBe(true);
    expect(result.current.showConfirmPassword).toBe(true);

    act(() => result.current.togglePassword());
    expect(result.current.showPassword).toBe(false);
    expect(result.current.showConfirmPassword).toBe(true);
  });

  it('setters allow manual control', () => {
    const { result } = renderHook(() => useMultiplePasswordToggle());

    act(() => result.current.setShowPassword(true));
    act(() => result.current.setShowConfirmPassword(true));
    expect(result.current.showPassword).toBe(true);
    expect(result.current.showConfirmPassword).toBe(true);
  });
});
