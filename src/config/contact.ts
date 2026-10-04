/**
 * The one support address shown to users.
 *
 * The app showed two: support@lugn-trygg.se on /feedback and the no-JS
 * fallback, support@lugntrygg.se on the error screen. lugn-trygg.se is the
 * domain the backend sends mail from (noreply@lugn-trygg.se), so that is the
 * one kept. Whether the mailbox receives mail has to be confirmed by whoever
 * owns the domain (UI audit L-11).
 */
export const SUPPORT_EMAIL = 'support@lugn-trygg.se';
