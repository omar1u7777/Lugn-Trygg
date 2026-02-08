import { useState, useCallback } from 'react';
import { loginUser, api } from '../api/api';
import { API_ENDPOINTS } from '../api/constants';
import { useAuth } from '../contexts/AuthContext';
import { loadFirebaseAuthBundle } from '../services/lazyFirebase';
import { useAccessibility } from './useAccessibility';
import { AUTH_MESSAGES, mapServerErrorToFriendly } from '../constants/authMessages';

interface FieldErrors {
  email?: string;
  password?: string;
}

interface LoginFormState {
  email: string;
  password: string;
  error: string;
  loading: boolean;
  fieldErrors: FieldErrors;
  capsLock: boolean;
  showPassword: boolean;
  showForgotPassword: boolean;
  showOnboardingModal: boolean;
  loggedInUserId: string | null;
}

export const useLoginForm = () => {
  const [state, setState] = useState<LoginFormState>({
    email: '',
    password: '',
    error: '',
    loading: false,
    fieldErrors: {},
    capsLock: false,
    showPassword: false,
    showForgotPassword: false,
    showOnboardingModal: false,
    loggedInUserId: null,
  });

  const { login } = useAuth();
  const { announceToScreenReader } = useAccessibility();

  const setEmail = useCallback((email: string) => {
    setState(prev => ({ ...prev, email }));
  }, []);

  const setPassword = useCallback((password: string) => {
    setState(prev => ({ ...prev, password }));
  }, []);

  const setError = useCallback((error: string) => {
    setState(prev => ({ ...prev, error }));
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    setState(prev => ({ ...prev, loading }));
  }, []);

  const setFieldErrors = useCallback((fieldErrors: FieldErrors) => {
    setState(prev => ({ ...prev, fieldErrors }));
  }, []);

  const setCapsLock = useCallback((capsLock: boolean) => {
    setState(prev => ({ ...prev, capsLock }));
  }, []);

  const setShowPassword = useCallback((showPassword: boolean) => {
    setState(prev => ({ ...prev, showPassword }));
  }, []);

  const setShowForgotPassword = useCallback((showForgotPassword: boolean) => {
    setState(prev => ({ ...prev, showForgotPassword }));
  }, []);

  const setShowOnboardingModal = useCallback((showOnboardingModal: boolean) => {
    setState(prev => ({ ...prev, showOnboardingModal }));
  }, []);

  const setLoggedInUserId = useCallback((loggedInUserId: string | null) => {
    setState(prev => ({ ...prev, loggedInUserId }));
  }, []);

  const validateForm = useCallback((): boolean => {
    const newFieldErrors: FieldErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!state.email.trim()) {
      newFieldErrors.email = AUTH_MESSAGES.EMAIL_REQUIRED;
    } else if (!emailRegex.test(state.email)) {
      newFieldErrors.email = AUTH_MESSAGES.INVALID_EMAIL;
    }

    if (!state.password.trim()) {
      newFieldErrors.password = AUTH_MESSAGES.PASSWORD_REQUIRED_SHORT;
    }

    setFieldErrors(newFieldErrors);
    return Object.keys(newFieldErrors).length === 0;
  }, [state.email, state.password, setFieldErrors]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (state.loading) return;

    if (!validateForm()) {
      const summary = 'Vänligen fyll i alla obligatoriska fält.';
      setError(summary);
      announceToScreenReader(summary, 'assertive');
      return;
    }

    setLoading(true);
    setError('');
    setFieldErrors({});
    announceToScreenReader(AUTH_MESSAGES.LOGGING_IN, 'polite');

    try {
      const data = await loginUser(state.email, state.password);
      login(data.access_token, state.email, data.user_id);
      setLoggedInUserId(data.user_id);
      announceToScreenReader(AUTH_MESSAGES.LOGIN_SUCCESS, 'polite');

      try {
        const seen = localStorage.getItem('wellness_onboarding_completed') || localStorage.getItem('wellness_onboarding_skipped');
        if (!seen) setShowOnboardingModal(true);
      } catch (err) {
        // ignore localStorage errors
      }
    } catch (err: unknown) {
      const friendly = mapServerErrorToFriendly(
        err instanceof Error && 'response' in err && typeof err.response === 'object' && err.response && 'data' in err.response && typeof err.response.data === 'object' && err.response.data && 'error' in err.response.data
          ? String(err.response.data.error)
          : err instanceof Error ? err.message : null
      );
      setError(friendly.general);
      setFieldErrors(friendly.fieldErrors || {});
      announceToScreenReader(`${AUTH_MESSAGES.LOGIN_FAILED}: ${friendly.general}`, 'assertive');
    } finally {
      setLoading(false);
    }
  }, [state.loading, state.email, state.password, validateForm, setError, setFieldErrors, setLoading, setLoggedInUserId, setShowOnboardingModal, login, announceToScreenReader]);

  const handleGoogleSignIn = useCallback(async () => {
    if (state.loading) return;

    setLoading(true);
    setError('');
    setFieldErrors({});
    announceToScreenReader(AUTH_MESSAGES.LOGGING_IN_GOOGLE, 'polite');

    try {
      const { firebaseAuth, authModule } = await loadFirebaseAuthBundle();
      const { GoogleAuthProvider, signInWithPopup } = authModule;
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(firebaseAuth, provider);
      const user = result.user;

      await new Promise(resolve => setTimeout(resolve, 1000));
      const idToken = await user.getIdToken();
      const response = await api.post(API_ENDPOINTS.AUTH.GOOGLE_LOGIN, { id_token: idToken });

      const data = response.data;
      login(data.access_token, user.email!, data.user_id);
      setLoggedInUserId(data.user_id);
      announceToScreenReader(AUTH_MESSAGES.GOOGLE_LOGIN_SUCCESS, 'polite');

      try {
        const seen = localStorage.getItem('wellness_onboarding_completed') || localStorage.getItem('wellness_onboarding_skipped');
        if (!seen) setShowOnboardingModal(true);
      } catch {}
    } catch (err: unknown) {
      const errorMessage = err instanceof Error && 'response' in err && typeof err.response === 'object' && err.response && 'data' in err.response && typeof err.response.data === 'object' && err.response.data && 'error' in err.response.data
        ? String(err.response.data.error)
        : err instanceof Error ? err.message : AUTH_MESSAGES.GOOGLE_LOGIN_FAILED;
      setError(errorMessage);
      announceToScreenReader(`${AUTH_MESSAGES.GOOGLE_LOGIN_FAILED}: ${errorMessage}`, 'assertive');
    } finally {
      setLoading(false);
    }
  }, [state.loading, setLoading, setError, setFieldErrors, setLoggedInUserId, setShowOnboardingModal, login, announceToScreenReader]);

  const handleKeyUp = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLock((e.getModifierState && e.getModifierState('CapsLock')) || false);
  }, [setCapsLock]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLock((e.getModifierState && e.getModifierState('CapsLock')) || false);
  }, [setCapsLock]);

  return {
    ...state,
    setEmail,
    setPassword,
    setError,
    setLoading,
    setFieldErrors,
    setCapsLock,
    setShowPassword,
    setShowForgotPassword,
    setShowOnboardingModal,
    setLoggedInUserId,
    handleSubmit,
    handleGoogleSignIn,
    handleKeyUp,
    handleKeyDown,
  };
};