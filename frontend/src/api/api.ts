import axios from "axios";

// Bas-URL för API
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:5001/api";  // Default till 5001 om inte definierat

//  API-funktion för att logga in en användare
export const loginUser = async (email: string, password: string) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      email,
      password,
    });

    // Kontrollera om response innehåller nödvändig data
    if (response.data && response.data.access_token) {
      return response.data; // Returnera användardata och token vid framgång
    } else {
      throw new Error("Inloggning misslyckades: Saknar access-token");
    }
  } catch (error: any) {
    const errorMessage = error.response?.data?.message || error.message || "Ett fel uppstod vid inloggning.";
    console.error("❌ API Login error:", errorMessage);
    throw new Error(errorMessage);
  }
};

//  API-funktion för att registrera en användare
export const registerUser = async (email: string, password: string, confirmPassword: string) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/register`, {
      email,
      password,
      confirmPassword,
    });

    if (response.data && response.data.message) {
      return response.data;
    } else {
      throw new Error("Registrering misslyckades: Inget svar från servern");
    }
  } catch (error: any) {
    const errorMessage = error.response?.data?.message || error.message || "Ett fel uppstod vid registrering.";
    console.error("❌ API Register error:", errorMessage);
    throw new Error(errorMessage);
  }
};

//  API-funktion för att hämta användardata med token
export const getUserProfile = async (token: string) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.data) {
      return response.data;
    } else {
      throw new Error("Användardata saknas.");
    }
  } catch (error: any) {
    const errorMessage = error.response?.data?.message || error.message || "Ett fel uppstod vid hämtning av användardata.";
    console.error("❌ API Profile error:", errorMessage);
    throw new Error(errorMessage);
  }
};

//  API-funktion för att logga ut användaren
export const logoutUser = async (token: string) => {
  try {
    await axios.post(
      `${API_BASE_URL}/auth/logout`,
      {}, // Tomt objekt som används för att skicka med data i POST-anropet
      { headers: { Authorization: `Bearer ${token}` } }
    );
  } catch (error: any) {
    const errorMessage = error.response?.data?.message || error.message || "Ett fel uppstod vid utloggning.";
    console.error("⚠️ API Logout error:", errorMessage);
  }
};
