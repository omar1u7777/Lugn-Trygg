import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import "../../styles/styles.css";

interface ProtectedRouteProps {
  children: ReactNode;
}

// 🔒 Komponent som skyddar vissa routes och endast tillåter inloggade användare
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isLoggedIn } = useAuth(); // Hämtar autentiseringsstatus
  const location = useLocation(); // Håller koll på aktuell URL

  // 🛑 Omdirigera om användaren inte är inloggad
  if (!isLoggedIn()) {
    console.warn("⚠️ Användaren är inte inloggad, omdirigerar till login...");
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // ✅ Rendera den skyddade sidan om användaren är inloggad
  return <>{children}</>;
};

export default ProtectedRoute;
