/**
 * Pull the message meant for a human out of an API error.
 *
 * The backend answers in two shapes:
 *
 *   APIResponse.error()  ->  { error: "SERVICE_UNAVAILABLE", message: "Betaltjänsten är tillfälligt otillgänglig" }
 *   middleware           ->  { error: "CSRF-token saknas" }
 *
 * In the first, `error` is a machine code and `message` is the text. In the
 * second there is no `message` and `error` is the text. Callers were reading
 * `error` in both cases, so a failed upgrade showed the user the literal
 * string "SERVICE_UNAVAILABLE" instead of the Swedish sentence the backend had
 * carefully written — and a 400 showed "BAD_REQUEST".
 */

/** ALL_CAPS_WITH_UNDERSCORES, i.e. an error code rather than a sentence. */
const looksLikeErrorCode = (value: string): boolean => /^[A-Z][A-Z0-9_]*$/.test(value.trim());

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;

/**
 * @param error    the thrown value, usually an Axios error
 * @param fallback shown when the response carries nothing usable
 */
export const extractErrorMessage = (error: unknown, fallback: string): string => {
  const response = asRecord(asRecord(error)?.response);
  const data = asRecord(response?.data);

  if (data) {
    const { message, error: errorField } = data;

    // APIResponse shape: the sentence lives here.
    if (typeof message === 'string' && message.trim() && !looksLikeErrorCode(message)) {
      return message;
    }

    // Middleware shape: `error` holds the sentence. Only use it when it is not
    // a bare code, so the user never reads "INTERNAL_ERROR".
    if (typeof errorField === 'string' && errorField.trim() && !looksLikeErrorCode(errorField)) {
      return errorField;
    }
  }

  // Deliberately no fallback to error.message. A thrown Error carries
  // developer text ("Network Error", "Request failed with status code 503",
  // or whatever we wrote at the throw site), and none of that is written for
  // someone who just wanted to upgrade or save a journal entry. The caller's
  // fallback is, so it wins.
  return fallback;
};
