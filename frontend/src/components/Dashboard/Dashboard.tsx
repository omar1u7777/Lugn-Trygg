import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import "../../styles/styles.css";
import MoodLogger from "../../components/MoodLogger";
import MemoryRecorder from "../../components/MemoryRecorder";
import MoodList from "../../components/MoodList";
import MemoryList from "../../components/MemoryList";
import Navigation from "../../components/Layout/Navigation";

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { isLoggedIn, user } = useAuth();
  const [activePopup, setActivePopup] = useState<"mood" | "memory" | "moodList" | "memoryList" | null>(null);

  useEffect(() => {
    if (!isLoggedIn()) {
      navigate("/login");
    }
  }, [isLoggedIn, navigate]);

  return (
    <>
      <Navigation />
      <div className="dashboard-container">
        <section className="dashboard-section intro-section">
          <h1 className="dashboard-title">🎉 Välkommen, {user?.email || "Användare"}!</h1>
          <p className="dashboard-text">
            🌿 Hantera dina inspelade minnen, logga ditt humör och ta del av avslappningsövningar.
            Vi har skapat en enkel och användarvänlig upplevelse, särskilt för äldre användare. 🎵
            Slappna av och njut av lugn och trygghet! 🎶 💖
          </p>
        </section>

        {/* 🚀 Dashboard-knappar */}
        <div className="dashboard-content">
          <button className="dashboard-btn mood-btn" onClick={() => setActivePopup("mood")}>
            🎭 Logga Humör
          </button>
          <button className="dashboard-btn memory-btn" onClick={() => setActivePopup("memory")}>
            🎙 Spela in Minne
          </button>
          <button className="dashboard-btn log-btn" onClick={() => setActivePopup("moodList")}>
            📋 Se Humörloggar
          </button>
          <button className="dashboard-btn log-btn" onClick={() => setActivePopup("memoryList")}>
            🎞 Se Mina Minnen
          </button>
        </div>

        {/* 🔹 Modal-container för popup-fönster */}
        {activePopup && (
          <div className="modal-container">
            <div className="popup-container">
              {activePopup === "mood" && <MoodLogger userEmail={user?.email || ""} onClose={() => setActivePopup(null)} />}
              {activePopup === "memory" && <MemoryRecorder userId={user?.user_id || ""} onClose={() => setActivePopup(null)} />}
              {activePopup === "moodList" && <MoodList onClose={() => setActivePopup(null)} />}
              {activePopup === "memoryList" && <MemoryList onClose={() => setActivePopup(null)} />}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default Dashboard;
