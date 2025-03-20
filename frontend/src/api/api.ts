import axios from "axios";

// 🔹 Bas-URL för API
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:5001/api";

// 🔹 Skapa en Axios-instans för API-anrop
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // 📡 Säkerställer att cookies skickas för session-hantering
  headers: { "Content-Type": "application/json" },
});

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
          isRefreshing = false;
          return api(originalRequest);
        }
      } catch (refreshError) {
        console.error("❌ Automatisk token-uppdatering misslyckades:", refreshError);
        isRefreshing = false;
        logoutUser();
      }
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
    window.location.href = "/login";
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

// 🔹 API-funktioner för humörloggning
export const logMood = async (userEmail: string, mood: string, transcript: string) => {
  try {
    const token = localStorage.getItem("token");
    const response = await api.post("/mood/log", { user_email: userEmail, mood, transcript }, { 
      headers: { Authorization: `Bearer ${token}` } 
    });
    return response.data;
  } catch (error: any) {
    console.error("❌ API Mood Log error:", error);
    throw new Error(error.response?.data?.error || "Ett fel uppstod vid humörloggning.");
  }
};

export const getMoods = async (userEmail: string) => {
  try {
    const token = localStorage.getItem("token"); // Hämtar token för autentisering
    const response = await api.get(`/mood/get?user_email=${userEmail}`, { 
      headers: { Authorization: `Bearer ${token}` } 
    });
    return response.data.moods || [];
  } catch (error: any) {
    console.error("❌ API Mood Fetch error:", error);
    throw new Error(error.response?.data?.error || "Ett fel uppstod vid hämtning av humörloggar.");
  }
};


// 🔹 API-funktioner för minneshantering
export const getMemories = async (userEmail: string) => {
  try {
    const token = localStorage.getItem("token");
    const response = await api.get(`/memory/list?user_email=${userEmail}`, { 
      headers: { Authorization: `Bearer ${token}` } 
    });
    return response.data.memories || [];
  } catch (error: any) {
    console.error("❌ API Memory Fetch error:", error);
    throw new Error(error.response?.data?.error || "Ett fel uppstod vid hämtning av minnen.");
  }
};

// 🔹 Ny funktion för uppladdning av ljudminne
export const uploadMemory = async (userEmail: string, audioBlob: Blob) => {
  const formData = new FormData();
  formData.append("audio", audioBlob, "memory_audio.mp3");
  formData.append("user_email", userEmail);

  const token = localStorage.getItem("token");
  try {
    const response = await api.post("memory/upload", formData, {
      headers: { 
        Authorization: `Bearer ${token}`,
        "Content-Type": "multipart/form-data" 
      },
    });
    return response.data;
  } catch (error: any) {
    console.error("❌ API Memory Upload error:", error);
    throw new Error(error.response?.data?.error || "Ett fel uppstod vid uppladdning av minnet.");
  }
};
