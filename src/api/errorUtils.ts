import { isAxiosError } from "axios";
import { isApiError } from "./errors";

interface ErrorPayload {
  error?: string;
  message?: string;
}

/**
 * Extract a human-readable message from a backend error payload.
 * When the payload is an object, backend-provided text wins and the fallback
 * (never the transport error's message) is used if the object carries none.
 */
const messageFromPayload = (
  data: unknown,
  transportMessage: string | undefined,
  fallbackMessage: string
): string => {
  if (typeof data === "object" && data !== null) {
    const payload = data as ErrorPayload;
    return payload.error || payload.message || fallbackMessage;
  }
  return transportMessage || fallbackMessage;
};

/**
 * Single message-extraction gateway for the unified error contract.
 * Handles ApiError (thrown by the api client interceptor), raw AxiosError
 * (from code bypassing the shared client), and plain Errors.
 */
export const getApiErrorMessage = (error: unknown, fallbackMessage: string): string => {
  if (isApiError(error)) {
    return messageFromPayload(error.data, error.message, fallbackMessage);
  }

  if (isAxiosError(error)) {
    return messageFromPayload(error.response?.data, error.message, fallbackMessage);
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallbackMessage;
};
