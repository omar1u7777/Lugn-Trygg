import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { logoutUser } from "../../api/api";
import "../../styles/styles.css";

function Dashboard() {
  const navigate = useNavigate();
  const { isLoggedIn, logout, user } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  //  Kontrollera om användaren är inloggad vid sidladdning
  useEffect(() => {
    if (!isLoggedIn()) {
      console.warn("⚠️ Användaren är inte inloggad, omdirigerar till login...");
      navigate("/login"); //  Omdirigerar till inloggningssidan om användaren inte är inloggad
    }
  }, [user, navigate]); //  Lyssnar på `user` för att fånga upp förändringar

  //  Hantera utloggning
  const handleLogout = async () => {
    setErrorMessage(null);

    try {
      if (user?.user_id) {
        await logoutUser(user.user_id); //  Anropa backend för att logga ut användaren
      }
      console.log("✅ Utloggning lyckades");
    } catch (error) {
      console.error("❌ Utloggningsfel:", error);
      setErrorMessage("Något gick fel vid utloggning. Försök igen!");
    } finally {
      logout(); // 🏁 Rensa autentiseringstillståndet
      navigate("/login"); //  Omdirigerar användaren till inloggningssidan
    }
  };

  return (
    <div className="dashboard-container">
      {/* 🏠 Navigation Header */}
      <header className="dashboard-header">
        <h2>Lugn & Trygg</h2>
        <button className="logout-button" onClick={handleLogout}>
          Logga ut
        </button>
      </header>

      {/* 📌 Huvudinnehåll */}
      <main className="dashboard-content">
        {/* ❌ Felmeddelande vid utloggningsproblem */}
        {errorMessage && <p className="error-message">{errorMessage}</p>}

        {/* 🎉 Välkomstmeddelande */}
        <h1>🎉 Välkommen, {user?.email || "Användare"}! 🧘‍♀️</h1>
        <p>
          🌿 Här kan du hantera dina inspelade minnen, logga ditt humör och ta del av avslappningsövningar. 🧘‍♂️
          Vi har skapat en enkel och användarvänlig upplevelse, särskilt för äldre användare. 🎵
          Slappna av och njut av lugn och trygghet! 🎶 💖
        </p>
      </main>
    </div>
  );
}

export default Dashboard;
