// Constants for authentication messages and strings
export const AUTH_MESSAGES = {
  LOGIN_SUCCESS: "Inloggning lyckades",
  LOGIN_FAILED: "Inloggning misslyckades",
  GOOGLE_LOGIN_SUCCESS: "Google-inloggning lyckades",
  GOOGLE_LOGIN_FAILED: "Google-inloggning misslyckades",
  DEFAULT_ERROR: "Ett fel uppstod vid inloggning",
  LOGGING_IN: "Loggar in...",
  LOGGING_IN_GOOGLE: "Loggar in med Google...",
  INVALID_EMAIL: "Ange en giltig e-postadress",
  PASSWORD_REQUIRED: "Lösenord är obligatoriskt",
  EMAIL_REQUIRED: "Fyll i din e-postadress.",
  PASSWORD_REQUIRED_SHORT: "Fyll i ditt lösenord.",
  INVALID_CREDENTIALS: "Fel e-postadress eller lösenord.",
  USER_NOT_FOUND: "Hittar inget konto med den e-posten.",
  TOO_MANY_ATTEMPTS: "För många misslyckade försök. Försök igen senare.",
  NETWORK_ERROR: "Nätverksfel. Kontrollera din uppkoppling.",
  CAPS_LOCK_WARNING: "Caps Lock är aktiverat.",
  TRUST_TEXT: "Du har full kontroll över din data.",
} as const;

// Error mapping function
export const mapServerErrorToFriendly = (serverMsg: string | null): { general: string; fieldErrors?: { email?: string; password?: string } } => {
  const result: { general: string; fieldErrors?: { email?: string; password?: string } } = { general: AUTH_MESSAGES.LOGIN_FAILED };
  if (!serverMsg) return result;
  const msg = serverMsg.toLowerCase();
  if (msg.includes('invalid_password') || msg.includes('invalid credentials') || msg.includes('invalid_password')) {
    result.general = AUTH_MESSAGES.INVALID_CREDENTIALS;
    result.fieldErrors = { password: 'Fel lösenord.' };
    return result;
  }
  if (msg.includes('user_not_found') || msg.includes('no user')) {
    result.general = AUTH_MESSAGES.INVALID_CREDENTIALS;
    result.fieldErrors = { email: 'Hittar inget konto med den e-posten.' };
    return result;
  }
  if (msg.includes('too_many_attempts') || msg.includes('rate limit')) {
    result.general = AUTH_MESSAGES.TOO_MANY_ATTEMPTS;
    return result;
  }
  if (msg.includes('network') || msg.includes('timeout')) {
    result.general = AUTH_MESSAGES.NETWORK_ERROR;
    return result;
  }
  // default: return server message shortened
  result.general = serverMsg.length > 80 ? serverMsg.slice(0, 77) + '...' : serverMsg;
  return result;
};