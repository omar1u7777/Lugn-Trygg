import { useState, useCallback } from 'react';

/**
 * Custom hook för password visibility toggle.
 *
 * Används av PasswordInput, som i sin tur används av LoginForm,
 * RegisterForm och ForgotPassword. Lägg toggle-logik här och inte inline
 * i en komponent — det var så det hann bli två implementationer, där den
 * som hade tester var den som ingen använde.
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

export default usePasswordToggle;
