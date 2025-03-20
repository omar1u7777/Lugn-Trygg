// 📌 Definiera tillåtna användarroller
export const USER_ROLES = ["user", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

// 📌 Definiera en typ för användarobjekt
export type User = {
  user_id: string;            // 🔹 Unik identifierare (ska matcha backend)
  email: string;              // 🔹 Användarens e-postadress
  name?: string;              // 🔹 (Valfritt) Fullständigt namn
  role?: UserRole;            // 🔹 Användarroll (default: "user")
  createdAt?: Date | string;  // 🔹 Konto skapat (kan vara undefined)
  updatedAt?: Date | string;  // 🔹 Senaste uppdatering av kontot (kan vara undefined)
  avatarUrl?: string;         // 🔹 (Valfritt) URL till profilbild
  isActive?: boolean;         // 🔹 Om kontot är aktivt (default: true)
  lastLogin?: Date | string;  // 🔹 Senaste inloggningsdatum (kan vara undefined)
};

// 📌 Definiera en typ för autentiseringssvar från backend
export type AuthResponse = {
  user: User;                  // 🔹 Användardata som returneras från backend
  access_token: string;        // 🔹 JWT-token för autentisering
  expires_in: number;          // 🔹 Antal sekunder innan token går ut (inte valfritt längre)
};

// 📌 Definiera en generisk typ för API-svar
export type ApiResponse<T> = {
  success: boolean;            // 🔹 Om förfrågan lyckades (true/false)
  statusCode: number;          // 🔹 HTTP-statuskod (ex: 200, 400, 500)
  message?: string;            // 🔹 Eventuellt meddelande från servern
  data?: T;                    // 🔹 Generisk data som returneras
  error?: string;              // 🔹 Eventuellt felmeddelande från servern
  headers?: Record<string, string>; // 🔹 Extra headers (t.ex. Rate-Limit info)
};

// 📌 Definiera en typ för API-fel
export type ApiError = {
  statusCode: number;          // 🔹 HTTP-statuskod (ex: 400, 401, 500)
  message: string;             // 🔹 Felmeddelande från servern
  details?: Record<string, any>; // 🔹 (Valfritt) Ytterligare detaljer om felet
};

// 📌 Definiera typen för autentiseringskontext
export type AuthContextProps = {
  user: User | null;               // 🔹 Inloggad användare eller null om ej inloggad
  setUser: (user: User | null) => void; // 🔹 Funktion för att uppdatera användaren
  token: string | null;            // 🔹 JWT-token eller null om ej inloggad
  setToken: (token: string | null) => void; // 🔹 Funktion för att uppdatera token
  isLoggedIn: () => boolean;       // 🔹 Funktion som returnerar true om användaren är inloggad
  login: (accessToken: string, email: string, user_id: string) => void; // 🔹 Hanterar inloggning
  logout: () => Promise<void>;      // 🔹 Hanterar utloggning
};
