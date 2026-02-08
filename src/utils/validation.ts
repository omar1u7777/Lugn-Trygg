export const validateEmail = (email: string): boolean => {
    const regex = /^[a-zA-ZåäöÅÄÖ0-9._%+\-]+@[a-zA-ZåäöÅÄÖ0-9.\-]+\.[a-zA-Z]{2,}$/;
    return regex.test(email);
  };
  
  export const validatePassword = (password: string): boolean => {
    return password.length >= 8;
  };
  
  export const validateConfirmPassword = (password: string, confirmPassword: string): boolean => {
    return password === confirmPassword;
  };
  