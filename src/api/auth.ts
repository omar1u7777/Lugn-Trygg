import axios from "axios";
import { tokenStorage } from "@/utils/secureStorage";
import { api } from "@/api/client";
import { API_ENDPOINTS } from "@/api/constants";
import { logger } from "@/utils/logger";

// TypeScript interfaces for API responses
interface User {
  id: string;
  email: string;
  name?: string;
  // Add additional user properties as needed
}

interface Referral {
  code: string;
  // Add additional referral properties as needed
}

interface LoginResponse {
  accessToken: string;
  refreshToken?: string;
  user: User;
  userId: string;
}

interface RegisterResponse {
  user: User;
  referral?: Referral;
}

interface ApiError {
  message?: string;
  error?: string;
}

interface ExportDataResponse {
  success: boolean;
  filename: string;
}

// Custom error class for authentication errors
class AuthError extends Error {
  constructor(message: string, public statusCode?: number, public originalError?: unknown) {
    super(message);
    this.name = 'AuthError';
  }
}

// API endpoints are now imported from constants.ts

// CSRF Token Manager class for better encapsulation and caching
class CsrfTokenManager {
  private token: string | null = null;
  private expiry: number | null = null;
  private readonly TOKEN_TTL = 3600000; // 1 hour in milliseconds

  async getToken(): Promise<string> {
    if (this.token && this.expiry && Date.now() < this.expiry) {
      return this.token;
    }

    try {
      const response = await api.get(API_ENDPOINTS.AUTH.CSRF_TOKEN);
      const token = response.data.csrfToken as string;
      if (!token) {
        throw new AuthError("Invalid CSRF token response");
      }
      this.token = token;
      this.expiry = Date.now() + this.TOKEN_TTL;
      return token;
    } catch (error) {
      logger.error("Failed to fetch CSRF token", { error });
      throw new AuthError("Failed to get CSRF token", undefined, error);
    }
  }

  clear(): void {
    this.token = null;
    this.expiry = null;
  }
}

export const csrfManager = new CsrfTokenManager();

// Helper function for extracting error messages and creating AuthError
const createAuthError = (error: unknown, defaultMessage: string): AuthError => {
  let message = defaultMessage;
  let statusCode: number | undefined;

  if (axios.isAxiosError(error) && error.response?.data) {
    const data = error.response.data as ApiError;
    message = data.message || data.error || message;
    statusCode = error.response.status;
  } else if (error instanceof Error) {
    message = error.message;
  }

  return new AuthError(message, statusCode, error);
};

// Utility functions for onboarding data management
const saveOnboardingData = (): Record<string, string> => {
  const onboardingKeys = Object.keys(localStorage).filter(key =>
    key.startsWith("onboarding_")
  );
  const saved: Record<string, string> = {};
  onboardingKeys.forEach(key => {
    const value = localStorage.getItem(key);
    if (value !== null) saved[key] = value;
  });
  return saved;
};

const restoreOnboardingData = (saved: Record<string, string>): void => {
  Object.entries(saved).forEach(([key, value]) => {
    localStorage.setItem(key, value);
  });
};

/**
 * Validates login response data
 * @param data - Response data from login API
 * @throws AuthError if data is invalid
 */
const validateLoginResponse = (data: unknown): LoginResponse => {
  if (!data || typeof data !== 'object') {
    throw new AuthError("Invalid login response format");
  }
  if (!(data as Record<string, unknown>).accessToken || typeof (data as Record<string, unknown>).accessToken !== 'string') {
    throw new AuthError("Login failed: Missing or invalid access token");
  }
  if (!(data as Record<string, unknown>).user || typeof (data as Record<string, unknown>).user !== 'object') {
    throw new AuthError("Login failed: Missing user data");
  }
  if (!(data as Record<string, unknown>).userId || typeof (data as Record<string, unknown>).userId !== 'string') {
    throw new AuthError("Login failed: Missing user ID");
  }
  return data as LoginResponse;
};

/**
 * Logs in a user with email and password
 * @param email - User's email address
 * @param password - User's password
 * @returns Promise resolving to user data including tokens
 * @throws AuthError if login fails
 */
export const loginUser = async (email: string, password: string): Promise<LoginResponse> => {
  try {
    const response = await api.post(API_ENDPOINTS.AUTH.LOGIN, { email, password });

    // Backend returns: { success: true, message: "...", data: { accessToken, refreshToken, user, userId } }
    const responseData = response.data?.data || response.data;
    const validatedData = validateLoginResponse(responseData);

    await tokenStorage.setAccessToken(validatedData.accessToken);
    if (validatedData.refreshToken) {
      await tokenStorage.setRefreshToken(validatedData.refreshToken);
    }

    // Fetch CSRF token after successful login
    try {
      await csrfManager.getToken();
    } catch (csrfError) {
      logger.warn("Failed to fetch CSRF token after login", { csrfError });
    }

    return validatedData;
  } catch (error: unknown) {
    tokenStorage.clearTokens();
    throw createAuthError(error, "Invalid login credentials");
  }
};

/**
 * Registers a new user account
 * @param email - User's email address
 * @param password - User's password
 * @param name - Optional display name
 * @param referralCode - Optional referral code
 * @returns Promise resolving to user registration data
 * @throws AuthError if registration fails
 */
export const registerUser = async (
  email: string,
  password: string,
  name?: string,
  referralCode?: string
): Promise<RegisterResponse> => {
  try {
    const response = await api.post(API_ENDPOINTS.AUTH.REGISTER, { email, password, name, referralCode });
    // Backend returns: { success: true, message: "...", data: { user: {...}, referral?: {...} } }
    const responseData = response.data?.data || response.data;

    if (!responseData || !responseData.user) {
      throw new AuthError("Registration failed: Invalid response data");
    }

    return responseData as RegisterResponse;
  } catch (error: unknown) {
    throw createAuthError(error, "Registration failed");
  }
};

/**
 * Logs out the current user and clears all stored data
 * @returns Promise that resolves when logout is complete
 */
export const logoutUser = async (): Promise<void> => {
  try {
    await api.post(API_ENDPOINTS.AUTH.LOGOUT);
  } catch (error: unknown) {
    logger.error("API Logout error", { error });
  } finally {
    // Save onboarding status before clearing
    const savedOnboarding = saveOnboardingData();

    // Clear secure token storage
    tokenStorage.clearTokens();

    // Clear CSRF token
    csrfManager.clear();

    // Clear all localStorage except onboarding
    localStorage.clear();

    // Restore onboarding status
    restoreOnboardingData(savedOnboarding);
  }
};

/**
 * Retrieves a fresh Firebase ID token
 * @returns Promise resolving to Firebase ID token or null if unavailable
 */
const getFirebaseToken = async (): Promise<string | null> => {
  try {
    const firebaseModule = await import("../firebase-config").catch(() => null);
    if (!firebaseModule) {
      logger.warn("Firebase module not available");
      return null;
    }

    const { auth } = firebaseModule;
    const currentUser = auth.currentUser;

    if (!currentUser) {
      logger.warn("No Firebase user found");
      return null;
    }

    const token = await currentUser.getIdToken(true);
    logger.debug("Firebase token refreshed successfully");
    return token;
  } catch (error) {
    logger.error("Firebase token refresh failed", { error });
    return null;
  }
};

/**
 * Refreshes the access token using Firebase authentication
 * @returns Promise resolving to new access token or null if refresh fails
 */
export const refreshAccessToken = async (): Promise<string | null> => {
  try {
    const newFirebaseToken = await getFirebaseToken();

    if (!newFirebaseToken) {
      logger.warn("Firebase token refresh failed");
      return null;
    }

    const response = await api.post(API_ENDPOINTS.AUTH.REFRESH_TOKEN, {
      id_token: newFirebaseToken
    });

    const responseData = response.data?.data || response.data;

    if (responseData?.accessToken && typeof responseData.accessToken === 'string') {
      await tokenStorage.setAccessToken(responseData.accessToken);
      if (responseData.refreshToken && typeof responseData.refreshToken === 'string') {
        await tokenStorage.setRefreshToken(responseData.refreshToken);
      }
      return responseData.accessToken;
    } else {
      logger.warn("Invalid refresh token response, logging out");
      await logoutUser();
      return null;
    }
  } catch (error: unknown) {
    logger.error("API Refresh Token error", { error });
    return null;
  }
};

// Password Management Functions

/**
 * Resets user password via email
 * @param email - Email address to send reset link to
 * @returns Promise resolving to reset response data
 * @throws AuthError if password reset fails
 */
export const resetPassword = async (email: string): Promise<Record<string, unknown>> => {
  try {
    const response = await api.post(API_ENDPOINTS.AUTH.RESET_PASSWORD, { email });
    return response.data;
  } catch (error: unknown) {
    throw createAuthError(error, "Password reset failed");
  }
};

/**
 * Changes user email address
 * @param newEmail - New email address
 * @param password - Current password for verification
 * @returns Promise resolving to email change response
 * @throws AuthError if email change fails
 */
export const changeEmail = async (newEmail: string, password: string): Promise<Record<string, unknown>> => {
  try {
    const response = await api.post(API_ENDPOINTS.AUTH.CHANGE_EMAIL, {
      newEmail: newEmail,
      password
    });
    return response.data;
  } catch (error: unknown) {
    throw createAuthError(error, "Email change failed");
  }
};

/**
 * Changes user password
 * @param currentPassword - Current password
 * @param newPassword - New password
 * @returns Promise resolving to password change response
 * @throws AuthError if password change fails
 */
export const changePassword = async (currentPassword: string, newPassword: string): Promise<Record<string, unknown>> => {
  try {
    const response = await api.post(API_ENDPOINTS.AUTH.CHANGE_PASSWORD, {
      current_password: currentPassword,
      new_password: newPassword
    });
    return response.data;
  } catch (error: unknown) {
    throw createAuthError(error, "Password change failed");
  }
};

// Two-Factor Authentication Functions

/**
 * Sets up two-factor authentication
 * @returns Promise resolving to 2FA setup data
 * @throws AuthError if 2FA setup fails
 */
export const setup2FA = async (): Promise<Record<string, unknown>> => {
  try {
    const response = await api.post(API_ENDPOINTS.AUTH.SETUP_2FA, {
      method: "totp"
    });
    return response.data;
  } catch (error: unknown) {
    throw createAuthError(error, "2FA setup failed");
  }
};

/**
 * Verifies and completes 2FA setup
 * @param code - Verification code from authenticator app
 * @returns Promise resolving to 2FA verification response
 * @throws AuthError if 2FA verification fails
 */
export const verify2FASetup = async (code: string): Promise<Record<string, unknown>> => {
  try {
    const response = await api.post(API_ENDPOINTS.AUTH.VERIFY_2FA_SETUP, {
      code
    });
    return response.data;
  } catch (error: unknown) {
    throw createAuthError(error, "2FA verification failed");
  }
};

// Account Management Functions

/**
 * Extracts filename from Content-Disposition header
 * @param contentDisposition - Header value
 * @returns Extracted filename or default
 */
const extractFilename = (contentDisposition: string | undefined): string => {
  if (!contentDisposition) return "user_data.json";

  const match = contentDisposition.match(/filename="(.+)"/);
  return match && match[1] ? match[1] : "user_data.json";
};

/**
 * Exports user data for download
 * @returns Promise resolving to export result with filename
 * @throws AuthError if data export fails
 */
export const exportUserData = async (): Promise<ExportDataResponse> => {
  try {
    const response = await api.get(API_ENDPOINTS.AUTH.EXPORT_DATA, {
      responseType: "blob"
    });

    if (!(response.data instanceof Blob)) {
      throw new AuthError("Invalid response data for export");
    }

    const url = window.URL.createObjectURL(response.data);
    const link = document.createElement("a");
    link.href = url;

    const filename = extractFilename(response.headers["content-disposition"]);

    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);

    return { success: true, filename };
  } catch (error: unknown) {
    throw createAuthError(error, "Data export failed");
  }
};

/**
 * Deletes user account permanently
 * @param userId - User ID to delete
 * @returns Promise resolving to account deletion response
 * @throws AuthError if account deletion fails
 */
export const deleteAccount = async (userId: string): Promise<Record<string, unknown>> => {
  if (!userId || typeof userId !== 'string') {
    throw new AuthError("Invalid user ID provided for account deletion");
  }

  try {
    const response = await api.delete(`${API_ENDPOINTS.AUTH.DELETE_ACCOUNT}/${userId}`);
    return response.data;
  } catch (error: unknown) {
    throw createAuthError(error, "Account deletion failed");
  }
};

/**
 * Legacy function for backward compatibility - use csrfManager.getToken() instead
 * @deprecated Use csrfManager.getToken() for better caching and management
 * @returns Promise resolving to CSRF token string
 * @throws AuthError if CSRF token fetch fails
 */
export const getCsrfToken = async (): Promise<string> => {
  return csrfManager.getToken();
};