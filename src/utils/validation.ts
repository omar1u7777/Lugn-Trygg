export const validateEmail = (email: string): boolean => {
  if (!email) {
    return false;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
  return emailRegex.test(email.trim());
};

export const validatePassword = (password: string): boolean => {
  return password.length >= 8;
};

export const validateConfirmPassword = (
  password: string,
  confirmPassword: string,
): boolean => {
  return password === confirmPassword;
};
