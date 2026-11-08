// Only the two fields read here, so every User shape in the app fits.
interface NamedUser {
  name?: string | null | undefined;
  displayName?: string | null | undefined;
}

// What the backend sends when no name is stored ("Okänd" from the login
// endpoint); shown as a name, it would greet someone as "Okänd".
const PLACEHOLDER_NAMES = new Set(['okänd', 'unknown', 'användare']);

/**
 * The name the person gave, or null when none is stored.
 *
 * The dashboard greeting, the account menu and /profile used to guess a name
 * from the e-mail address, dropping digits: "omaralhaek97@gmail.com" became
 * "Omaralhaek". Registration asks for a name and login returns it, so it is
 * used as given, and callers decide what to show without one.
 */
export const getUserName = (user: NamedUser | null | undefined): string | null => {
  for (const candidate of [user?.displayName, user?.name]) {
    const name = candidate?.trim();
    if (name && !PLACEHOLDER_NAMES.has(name.toLowerCase())) return name;
  }
  return null;
};
