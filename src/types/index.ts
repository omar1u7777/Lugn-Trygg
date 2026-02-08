import { logger } from "../utils/logger";

// 📌 Definiera tillåtna användarroller
export const USER_ROLES = ["user", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

// 📌 Definiera en typ för användarobjekt
export type User = {
  user_id: string;            // 🔹 Unik identifierare (ska matcha backend)
  email: string;              // 🔹 Användarens e-postadress
  name?: string;              // 🔹 (Valfritt) Fullständigt namn
  displayName?: string;       // 🔹 (Valfritt) Visningsnamn
  role?: UserRole;            // 🔹 Användarroll (default: "user")
  createdAt?: Date | string | undefined;  // 🔹 Konto skapat (ISO-format eller Date) - kan vara undefined
  updatedAt?: Date | string | undefined;  // 🔹 Senaste uppdatering - kan vara undefined
  avatarUrl?: string;         // 🔹 (Valfritt) Profilbilds-URL
  isActive?: boolean;         // 🔹 Aktivt konto (default: true)
  lastLogin?: Date | string | undefined;  // 🔹 Senaste inloggning - kan vara undefined
  streak?: number;            // 🔹 (Valfritt) Antal dagar i följd
  goals?: string[];           // 🔹 (Valfritt) Användarens mål
};

// 📌 Definiera en typ för autentiseringssvar från backend
export type AuthResponse = {
  user: User;                  // 🔹 Användaruppgifter från backend
  access_token: string;        // 🔹 JWT-token för autentisering
  expires_in?: number;         // 🔹 Antal sekunder tills access_token går ut
};

// 📌 Definiera en generisk typ för API-svar
export type ApiResponse<T> = {
  success: boolean;            // 🔹 Om förfrågan lyckades (true/false)
  statusCode: number;          // 🔹 HTTP-statuskod (ex: 200, 400, 500)
  message?: string;            // 🔹 Eventuellt meddelande från servern
  data?: T;                    // 🔹 Generisk data som returneras
  error?: string;              // 🔹 Eventuellt felmeddelande från servern
  headers?: Record<string, string>; // 🔹 Extra headers (t.ex. Rate-Limit)
};

// 📌 Definiera en typ för API-fel
export type ApiError = {
  statusCode: number;          // 🔹 HTTP-statuskod (ex: 400, 401, 500)
  message: string;             // 🔹 Felmeddelande från servern
  details?: Record<string, any>; // 🔹 (Valfritt) Ytterligare detaljer om felet
};

// 📌 Validera och konvertera datumsträngar till `Date`
export function parseUserDates(user: User): User {
  const parseDate = (date?: string | Date): Date | undefined => {
    if (!date) return undefined;
    const parsed = date instanceof Date ? date : new Date(date);
    if (isNaN(parsed.getTime())) {
      logger.error("Ogiltigt datumformat", undefined, { date });
      return undefined;
    }
    return parsed;
  };

  return {
    ...user,
    role: user.role ?? "user",  // ✅ Standardvärde för roll
    isActive: user.isActive ?? true, // ✅ Standardvärde: aktiv användare
    createdAt: parseDate(user.createdAt),  // ✅ Hantera undefined och invalid datum
    updatedAt: parseDate(user.updatedAt),  // ✅ Hantera undefined och invalid datum
    lastLogin: parseDate(user.lastLogin),  // ✅ Hantera undefined och invalid datum
  };
}

// 📌 Definiera en typ för autentiseringskontextens props
export type AuthContextProps = {
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  token: string | null;
  setToken: React.Dispatch<React.SetStateAction<string | null>>;
  isLoggedIn: boolean;  // ✅ Changed from function to boolean (useMemo value)
  login: (accessToken: string, emailOrUser: string | User, userId?: string) => Promise<void>;
  logout: () => Promise<void>;
  isInitialized?: boolean;
};
