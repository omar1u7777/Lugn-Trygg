/**
 * Date keys in the user's own timezone.
 *
 * `toISOString().split('T')[0]` produces a UTC day, which is not the day the
 * user experienced. In Sweden (UTC+1/+2) an entry logged at 00:30 lands on the
 * previous UTC date, so late-night activity is credited to yesterday — streaks
 * break, charts put entries in the wrong bar, and the user is told they missed
 * a day they did not miss. Late-night logging is common here and clinically
 * meaningful, so it has to be counted on the right day.
 *
 * This has already caused that bug in three separate places; keeping one
 * implementation is what stops a fourth.
 */

/** `YYYY-MM-DD` for the calendar day this instant falls on locally. */
export const toLocalDateKey = (date: Date): string => {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * Local date key for a timestamp of unknown provenance, or `null` if it is not
 * a usable date. Callers get one place to handle bad input instead of each
 * inventing its own guard — an unparseable timestamp previously became
 * `Invalid Date` and silently grouped entries under `NaN-NaN-NaN`.
 *
 * Accepts what the API layer actually returns: ISO strings, epoch millis, a
 * `Date`, and raw Firestore timestamps, which arrive as `{ seconds }` when a
 * document is read without going through the SDK converter.
 */
export const toLocalDateKeyFrom = (value: unknown): string | null => {
  if (!value) return null;

  let date: Date | undefined;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'object' && 'seconds' in value) {
    const { seconds } = value as { seconds: unknown };
    if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return null;
    date = new Date(seconds * 1000);
  } else if (typeof value === 'string' || typeof value === 'number') {
    date = new Date(value);
  }

  if (!date || Number.isNaN(date.getTime())) return null;
  return toLocalDateKey(date);
};
