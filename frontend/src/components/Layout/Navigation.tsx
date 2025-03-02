import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { logoutUser } from "../../api/api";
import Cookies from "js-cookie";
import "../../styles/styles.css";

const Navigation: React.FC = () => {
  const navigate = useNavigate();
  const { isLoggedIn, logout, user } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      if (user?.user_id) {
        await logoutUser(user.user_id);
      }
      logout();
      Cookies.remove("access_token");
      localStorage.removeItem("token");
      localStorage.removeItem("user");

      console.log("✅ Utloggning lyckades!");
      navigate("/login");
    } catch (error) {
      console.error("❌ Utloggningsfel:", error);
      alert("Något gick fel vid utloggning. Försök igen.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <nav className="nav-container" role="navigation" aria-label="Huvudmeny">
      <span className="app-name">Lugn & Trygg</span>
      <ul className="nav-links">
        {isLoggedIn() ? (
          <>
            <li>
              <Link to="/dashboard" aria-label="Gå till Dashboard">
                Dashboard
              </Link>
            </li>
            <li>
              <button
                className="logout-btn"
                onClick={handleLogout}
                disabled={loading}
                aria-label="Logga ut"
                aria-live="polite"
              >
                {loading ? "Loggar ut..." : "🚪 Logga ut"} {/* Emoji för Logout */}
              </button>
            </li>
          </>
        ) : (
          <>
            <li>
              <Link to="/login" aria-label="Logga in">
                Logga in
              </Link>
            </li>
            <li>
              <Link to="/register">Registrera</Link>
            </li>
          </>
        )}
      </ul>
    </nav>
  );
};

export default Navigation;
