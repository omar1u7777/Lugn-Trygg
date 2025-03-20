import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { logoutUser } from "../../api/api";
import Cookies from "js-cookie";
import "../../styles/styles.css";

const Navigation: React.FC = () => {
  const navigate = useNavigate();
  const { isLoggedIn, logout, user } = useAuth();

  const handleLogout = async () => {
    try {
      if (user?.user_id) {
        await logoutUser();
      }
      logout();
      Cookies.remove("access_token");
      localStorage.clear();
      
      console.log("✅ Utloggning lyckades!");
      navigate("/login");
    } catch (error) {
      console.error("❌ Utloggningsfel:", error);
      alert("Något gick fel vid utloggning. Försök igen.");
    }
  };

  return (
    <nav className="navbar">
      <div className="navbar-left">
        <Link to="/" className="app-name">Lugn & Trygg</Link>
      </div>
      
      <ul className="nav-links">
        {isLoggedIn() ? (
          <>
            <li>
              <Link to="/dashboard" className="nav-btn">
                📊 Dashboard
              </Link>
            </li>
            <li>
              <button className="nav-btn logout-btn" onClick={handleLogout}>
                🚪 Logga ut
              </button>
            </li>
          </>
        ) : (
          <>
            <li>
              <Link to="/login" className="nav-btn">
                🔒 Logga in
              </Link>
            </li>
            <li>
              <Link to="/register" className="nav-btn register-btn">
                📝 Registrera
              </Link>
            </li>
          </>
        )}
      </ul>
    </nav>
  );
};

export default Navigation;
