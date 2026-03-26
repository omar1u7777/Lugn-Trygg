import { isAxiosError } from "axios";

interface ErrorPayload {
  error?: string;
  message?: string;
}

export const getApiErrorMessage = (error: unknown, fallbackMessage: string): string => {
  if (isAxiosError(error)) {
    const data = error.response?.data;
    if (typeof data === "object" && data !== null) {
      const payload = data as ErrorPayload;
      return payload.error || payload.message || fallbackMessage;
    }

    return error.message || fallbackMessage;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallbackMessage;
};