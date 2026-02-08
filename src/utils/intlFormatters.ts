import i18n from '../i18n/i18n';

const RTL_LANGS = new Set(['ar', 'he', 'fa', 'ur']);

const getFallbackLocale = (): string => {
  const fallback = i18n.options.fallbackLng;
  if (Array.isArray(fallback)) {
    return fallback[0];
  }
  if (typeof fallback === 'string') {
    return fallback;
  }
  return 'sv';
};

export const getCurrentLocale = (): string => i18n.language || getFallbackLocale();

export const isRtlLocale = (locale = getCurrentLocale()): boolean => {
  const normalized = locale.split('-')[0];
  return RTL_LANGS.has(normalized);
};

const toDate = (value: Date | string | number): Date | null => {
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
};

export const formatDateTime = (
  value: Date | string | number,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }
): string => {
  const date = toDate(value);
  if (!date) {
    return '';
  }
  try {
    return new Intl.DateTimeFormat(getCurrentLocale(), options).format(date);
  } catch {
    return date.toLocaleString();
  }
};

export const formatNumber = (
  value: number,
  options: Intl.NumberFormatOptions = { maximumFractionDigits: 0 }
): string => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '';
  }
  try {
    return new Intl.NumberFormat(getCurrentLocale(), options).format(value);
  } catch {
    return value.toString();
  }
};

const DIVISIONS: Array<{ amount: number; unit: Intl.RelativeTimeFormatUnit }> = [
  { amount: 60, unit: 'second' },
  { amount: 60, unit: 'minute' },
  { amount: 24, unit: 'hour' },
  { amount: 7, unit: 'day' },
  { amount: 4.34524, unit: 'week' },
  { amount: 12, unit: 'month' },
  { amount: Number.POSITIVE_INFINITY, unit: 'year' },
];

export const formatRelativeTimeFromNow = (value: Date | string | number): string => {
  const date = toDate(value);
  if (!date) {
    return '';
  }
  const locale = getCurrentLocale();
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  let duration = (date.getTime() - Date.now()) / 1000;

  for (const division of DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return rtf.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }

  return rtf.format(0, 'second');
};
