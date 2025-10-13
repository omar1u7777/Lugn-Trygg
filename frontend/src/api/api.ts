import axios from "axios"; // @ts-ignore
import CryptoJS from "crypto-js";

// 🔹 Bas-URL för API
export const API_BASE_URL = "/api";

// 🔹 Skapa en Axios-instans för API-anrop
export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // 📡 Säkerställer att cookies skickas för session-hantering
  headers: { "Content-Type": "application/json" },
});

// 🔹 Exportera api som default export
export default api;

// 🔹 Förhindrar oändlig loop vid token-refresh
let isRefreshing = false;

// 🔹 Hantera 401 Unauthorized globalt och förnya token vid behov
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) return Promise.reject(error);

      isRefreshing = true;
      originalRequest._retry = true;

      try {
        const newAccessToken = await refreshAccessToken();
        if (newAccessToken) {
          localStorage.setItem("token", newAccessToken);
          api.defaults.headers["Authorization"] = `Bearer ${newAccessToken}`;
          originalRequest.headers["Authorization"] = `Bearer ${newAccessToken}`;
          console.log("🔄 Token refreshed successfully");
          isRefreshing = false;
          return api(originalRequest);
        }
      } catch (refreshError) {
        console.error("❌ Automatisk token-uppdatering misslyckades:", refreshError);
        console.warn("⚠️ Token refresh failed, logging out user");
        isRefreshing = false;
        logoutUser();
      }
    }

    // Enhanced error logging
    if (error.response) {
      console.error("API Error Response:", {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        url: originalRequest?.url,
        method: originalRequest?.method
      });
    } else if (error.request) {
      console.error("API Network Error:", {
        message: error.message,
        url: originalRequest?.url,
        method: originalRequest?.method
      });
    } else {
      console.error("API Error:", error.message);
    }

    return Promise.reject(error);
  }
);

// 🔹 API-funktion för att logga in en användare
export const loginUser = async (email: string, password: string) => {
  try {
    const response = await api.post("/auth/login", { email, password });
    
    if (response.data?.access_token) {
      localStorage.setItem("token", response.data.access_token);
      localStorage.setItem("refresh_token", response.data.refresh_token);
      return response.data;
    } else {
      throw new Error("Inloggning misslyckades: Saknar access-token");
    }
  } catch (error: any) {
    console.error("❌ API Login error:", error);
    localStorage.clear();
    throw new Error(error.response?.data?.error || "Felaktiga inloggningsuppgifter.");
  }
};

// 🔹 API-funktion för att registrera en användare
export const registerUser = async (email: string, password: string) => {
  try {
    const response = await api.post("/auth/register", { email, password });
    return response.data;
  } catch (error: any) {
    console.error("❌ API Register error:", error);
    throw new Error(error.response?.data?.error || "Ett fel uppstod vid registrering.");
  }
};

// 🔹 API-funktion för att logga ut användaren
export const logoutUser = async () => {
  try {
    await api.post("/auth/logout");
  } catch (error: any) {
    console.error("⚠️ API Logout error:", error);
  } finally {
    localStorage.clear();
    // Don't force a page refresh - let React Router handle navigation
    // The AuthContext will handle the redirect
  }
};

// 🔹 API-funktion för att förnya access-token automatiskt
export const refreshAccessToken = async () => {
  try {
    const refreshToken = localStorage.getItem("refresh_token");
    if (!refreshToken) return null;

    const response = await api.post("/auth/refresh", { refresh_token: refreshToken });
    
    if (response.data?.access_token) {
      localStorage.setItem("token", response.data.access_token);
      return response.data.access_token;
    } else {
      logoutUser();
      return null;
    }
  } catch (error: any) {
    console.error("❌ API Refresh Token error:", error);
    logoutUser();
    return null;
  }
};

// 🔹 Krypteringshjälpfunktioner
const ENCRYPTION_KEY = import.meta.env.VITE_ENCRYPTION_KEY;

const encryptData = (data: string): string => {
  return CryptoJS.AES.encrypt(data, ENCRYPTION_KEY).toString();
};

// 🔹 API-funktioner för humörloggning
export const logMood = async (userId: string, mood: string, score: number) => {
  try {
    const token = localStorage.getItem("token");
    // Encrypt sensitive mood data
    const encryptedMood = encryptData(mood);

    const response = await api.post("/mood/log", {
      user_id: userId,
      mood: encryptedMood,
      score
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  } catch (error: any) {
    console.error("❌ API Mood Log error:", error);
    throw new Error(error.response?.data?.error || "Ett fel uppstod vid humörloggning.");
  }
};

export const getMoods = async (userId: string) => {
  try {
    const token = localStorage.getItem("token");
    const response = await api.get(`/mood/get?user_id=${userId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data.moods || [];
  } catch (error: any) {
    console.error("❌ API Mood Fetch error:", error);
    throw new Error(error.response?.data?.error || "Ett fel uppstod vid hämtning av humörloggar.");
  }
};

// 🔹 API-funktion för veckoanalys
export const getWeeklyAnalysis = async (userId: string) => {
  try {
    const token = localStorage.getItem("token");
    const response = await api.get(`/mood/weekly-analysis?user_id=${userId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  } catch (error: any) {
    console.error("❌ API Weekly Analysis error:", error);
    throw new Error(error.response?.data?.error || "Ett fel uppstod vid veckoanalys.");
  }
};

// 🔹 API-funktioner för minneshantering
export const getMemories = async (userId: string) => {
  try {
    const token = localStorage.getItem("token");
    const response = await api.get(`/memory/list?user_id=${userId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data.memories || [];
  } catch (error: any) {
    console.error("❌ API Memory Fetch error:", error);
    throw new Error(error.response?.data?.error || "Ett fel uppstod vid hämtning av minnen.");
  }
};

// 🔹 Hämta signerad URL för minne
export const getMemoryUrl = async (userId: string, filePath: string) => {
  try {
    const token = localStorage.getItem("token");
    const response = await api.get(`/memory/get?user_id=${userId}&file_path=${encodeURIComponent(filePath)}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data.url;
  } catch (error: any) {
    console.error("❌ API Memory URL error:", error);
    throw new Error(error.response?.data?.error || "Ett fel uppstod vid hämtning av minne-URL.");
  }
};

// 🔹 Återställ lösenord via e-post
export const resetPassword = async (email: string) => {
  try {
    const response = await api.post("/auth/reset-password", { email });
    return response.data;
  } catch (error: any) {
    console.error("❌ API Reset Password error:", error);
    throw new Error(error.response?.data?.error || "Ett fel uppstod vid lösenordsåterställning.");
  }
};

// 🔹 Chatbot API-funktioner
export const chatWithAI = async (userId: string, message: string) => {
  try {
    console.log("API: Starting chatWithAI call", { userId, messageLength: message.length });
    const token = localStorage.getItem("token");
    console.log("API: Token available:", !!token);

    const response = await api.post("/chatbot/chat", {
      user_id: userId,
      message: message
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log("API: Chat response received successfully", {
      hasResponse: !!response.data.response,
      status: response.status
    });
    return response.data;
  } catch (error: any) {
    console.error("❌ API Chat error:", error);
    console.error("❌ API Chat error details:", {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    throw new Error(error.response?.data?.error || "Ett fel uppstod vid chatt.");
  }
};

export const getChatHistory = async (userId: string) => {
  try {
    console.log("API: Starting getChatHistory call for user:", userId);
    const token = localStorage.getItem("token");
    console.log("API: Token available for history:", !!token);

    const response = await api.get(`/chatbot/history?user_id=${userId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log("API: Chat history response received", {
      conversationLength: response.data.conversation?.length || 0,
      status: response.status
    });
    return response.data.conversation || [];
  } catch (error: any) {
    console.error("❌ API Chat History error:", error);
    console.error("❌ API Chat History error details:", {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    throw new Error(error.response?.data?.error || "Ett fel uppstod vid hämtning av chatt-historik.");
  }
};

export const analyzeMoodPatterns = async (userId: string) => {
  try {
    const token = localStorage.getItem("token");
    const response = await api.post("/chatbot/analyze-patterns", {
      user_id: userId
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  } catch (error: any) {
    console.error("❌ API Pattern Analysis error:", error);
    throw new Error(error.response?.data?.error || "Ett fel uppstod vid mönsteranalys.");
  }
};

export const analyzeVoiceEmotion = async (userId: string, audioData: string, transcript: string) => {
  try {
    const token = localStorage.getItem("token");
    const response = await api.post("/mood/analyze-voice", {
      user_id: userId,
      audio_data: audioData,
      transcript: transcript
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  } catch (error: any) {
    console.error("❌ API Voice Analysis error:", error);
    throw new Error(error.response?.data?.error || "Ett fel uppstod vid röstanalys.");
  }
};