import { useState, useCallback } from 'react';

/**
 * Custom hook för password visibility toggle
 * Används i LoginForm, RegisterForm och andra password input components
 * 
 * @returns {Object} - showPassword state och toggle funktion
 * 
 * @example
 * ```tsx
 * const { showPassword, togglePassword } = usePasswordToggle();
 * 
 * <Input
 *   type={showPassword ? "text" : "password"}
 *   value={password}
 *   onChange={(e) => setPassword(e.target.value)}
 * />
 * <button onClick={togglePassword}>
 *   {showPassword ? <EyeSlashIcon /> : <EyeIcon />}
 * </button>
 * ```
 */
export const usePasswordToggle = (initialState: boolean = false) => {
  const [showPassword, setShowPassword] = useState(initialState);

  const togglePassword = useCallback(() => {
    setShowPassword((prev) => !prev);
  }, []);

  return {
    showPassword,
    togglePassword,
    setShowPassword, // För manuell kontroll om behövs
  };
};

/**
 * Custom hook för multiple password fields (password + confirm password)
 * 
 * @example
 * ```tsx
 * const { 
 *   showPassword, 
 *   showConfirmPassword, 
 *   togglePassword, 
 *   toggleConfirmPassword 
 * } = useMultiplePasswordToggle();
 * ```
 */
export const useMultiplePasswordToggle = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const togglePassword = useCallback(() => {
    setShowPassword((prev) => !prev);
  }, []);

  const toggleConfirmPassword = useCallback(() => {
    setShowConfirmPassword((prev) => !prev);
  }, []);

  return {
    showPassword,
    showConfirmPassword,
    togglePassword,
    toggleConfirmPassword,
    setShowPassword,
    setShowConfirmPassword,
  };
};

export default usePasswordToggle;
