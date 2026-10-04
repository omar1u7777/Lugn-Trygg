/**
 * The single source of truth for crisis contact data.
 *
 * Before this file the same helpline appeared with three different numbers in
 * three places: `0900-011 200` on /recommendations (in the CBT disclaimer, the
 * crisis modal and the main disclaimer), `90101` in the AI chat and the PHQ-9
 * safety plan, and on /crisis no number at all — only a chat link. At most one
 * of those could be right, and the wrong one was the most prominent.
 *
 * Mind Självmordslinjen is 90101. Verified against mind.se.
 *
 * WHY THE NUMBERS ARE NOT TRANSLATABLE
 * ------------------------------------
 * They are data, not copy. A translated string can drift per locale without
 * anything failing, and a helpline number that drifts is a safety defect, not
 * a cosmetic one. Translations interpolate these values ({{number}}) rather
 * than embedding digits, so sv/en/no cannot disagree about who to call.
 *
 * Presentation (name, description, availability) IS translated, via the i18n
 * key prefix on each resource.
 */

/** Dial strings, referenced anywhere a crisis number is shown. */
export const CRISIS_NUMBERS = {
  /** Emergency services (Sweden). */
  emergency: '112',
  /** Mind Självmordslinjen. */
  suicideLine: '90101',
  /** Vårdguiden — healthcare advice. */
  healthcare: '1177',
  /** BRIS — children and young people up to 18. */
  bris: '116 111',
  /** Jourhavande Medmänniska. */
  companion: '08-702 00 20',
} as const;

/** `tel:` targets. Kept separate: the dialable form has no spaces. */
export const CRISIS_TEL = {
  emergency: 'tel:112',
  suicideLine: 'tel:90101',
  healthcare: 'tel:1177',
  bris: 'tel:116111',
  companion: 'tel:08-7020020',
} as const;

export const CRISIS_LINKS = {
  /** The old deep link 404s — Mind restructured their site. Verified live. */
  mindChat: 'https://mind.se/chatt/',
  spes: 'https://www.spes.se/',
  healthcareWeb: 'https://www.1177.se/',
} as const;

export type CrisisPriority = 'critical' | 'urgent' | 'high' | 'medium' | 'support';

export interface CrisisResource {
  readonly id: string;
  readonly priority: CrisisPriority;
  /** Emoji shown before the translated title. Not translated. */
  readonly emoji: string;
  /** Where the action button goes. */
  readonly href: string;
  /** Opens in a new tab, and gets the globe icon rather than the phone icon. */
  readonly external?: boolean;
  /**
   * A dialable number to show on the card, when the resource has one.
   *
   * Mind is listed twice on purpose — the phone line and the chat are separate
   * ways in, and the QA pass found the chat card presenting itself as the whole
   * of Mind, with no number at all.
   */
  readonly phone?: string;
}

/**
 * Ordered by urgency: emergency first, then the crisis lines, then support.
 * The order is the reading order on /crisis, so it is part of the contract.
 *
 * Copy for each entry lives under `crisis.page.resources.<id>` in the locale
 * files: `title`, `subtitle`, `description`, `action`, `available`.
 */
export const CRISIS_RESOURCES: readonly CrisisResource[] = [
  {
    id: 'emergency',
    priority: 'critical',
    emoji: '🚨',
    href: CRISIS_TEL.emergency,
    phone: CRISIS_NUMBERS.emergency,
  },
  {
    id: 'suicideLine',
    priority: 'urgent',
    emoji: '💙',
    href: CRISIS_TEL.suicideLine,
    phone: CRISIS_NUMBERS.suicideLine,
  },
  {
    id: 'mindChat',
    priority: 'high',
    emoji: '💬',
    href: CRISIS_LINKS.mindChat,
    external: true,
    // Deliberately carries the number too. The chat card used to be the only
    // place Mind appeared on this page, and it showed no number at all.
    phone: CRISIS_NUMBERS.suicideLine,
  },
  {
    id: 'healthcare',
    priority: 'medium',
    emoji: '🏥',
    href: CRISIS_TEL.healthcare,
    phone: CRISIS_NUMBERS.healthcare,
  },
  {
    id: 'priest',
    priority: 'medium',
    emoji: '⛪',
    // Reached by calling 112 and asking to be connected. The instruction has to
    // be in the copy, or the number alone just reaches emergency dispatch.
    href: CRISIS_TEL.emergency,
    phone: CRISIS_NUMBERS.emergency,
  },
  {
    id: 'bris',
    priority: 'support',
    emoji: '🧸',
    href: CRISIS_TEL.bris,
    phone: CRISIS_NUMBERS.bris,
  },
  {
    id: 'spes',
    priority: 'support',
    emoji: '🕯️',
    href: CRISIS_LINKS.spes,
    external: true,
  },
  {
    id: 'companion',
    priority: 'support',
    emoji: '🤝',
    href: CRISIS_TEL.companion,
    phone: CRISIS_NUMBERS.companion,
  },
] as const;

/** Tailwind classes per resource id. Presentation only — no data here. */
export const CRISIS_RESOURCE_STYLES: Record<string, {
  button: string; text: string; border: string;
}> = {
  emergency: { button: 'bg-red-600 hover:bg-red-700', text: 'text-red-600', border: 'border-red-500' },
  suicideLine: { button: 'bg-rose-600 hover:bg-rose-700', text: 'text-rose-600', border: 'border-rose-500' },
  mindChat: { button: 'bg-purple-600 hover:bg-purple-700', text: 'text-purple-600', border: 'border-purple-500' },
  healthcare: { button: 'bg-green-600 hover:bg-green-700', text: 'text-green-600', border: 'border-green-500' },
  priest: { button: 'bg-blue-600 hover:bg-blue-700', text: 'text-blue-600', border: 'border-blue-500' },
  bris: { button: 'bg-orange-500 hover:bg-orange-600', text: 'text-orange-500', border: 'border-orange-500' },
  spes: { button: 'bg-teal-600 hover:bg-teal-700', text: 'text-teal-600', border: 'border-teal-500' },
  companion: { button: 'bg-indigo-600 hover:bg-indigo-700', text: 'text-indigo-600', border: 'border-indigo-500' },
};
