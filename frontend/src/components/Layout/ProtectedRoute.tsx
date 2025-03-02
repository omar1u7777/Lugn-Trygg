import { ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import "../../styles/styles.css";

interface ProtectedRouteProps {
  children: ReactNode;
}

//  Komponent som skyddar vissa routes och endast tillåter inloggade användare
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isLoggedIn } = useAuth(); //  Hämtar autentiseringsstatus
  const location = useLocation(); //  Håller koll på aktuell URL
  const navigate = useNavigate(); // Hanterar navigation
  const [isAuthChecked, setIsAuthChecked] = useState(false); // ⏳ Laddningsstatus för inloggningskontroll

  useEffect(() => {
    console.log("🔍 Skyddad route laddad - Kontroll av inloggning...");
    setIsAuthChecked(true); //  Markerar att inloggningskontrollen har körts

    if (isLoggedIn()) {
      console.log("✅ Användaren är inloggad - Navigerar till dashboard...");
      navigate("/dashboard", { replace: true }); // Skickar användaren till dashboard
    } else {
      console.warn("⚠️ Användaren är inte inloggad, omdirigerar till login...");
    }
  }, [isLoggedIn, navigate]); //  Lyssnar på `isLoggedIn` och `navigate` för att agera vid förändringar

  //  Om kontrollen inte har slutförts, visa en laddningsindikator
  if (!isAuthChecked) {
    return <div>🔄 Laddar...</div>;
  }

  //  Om användaren inte är inloggad, omdirigera till inloggningssidan och behåll deras nuvarande plats
  if (!isLoggedIn()) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  //  Om användaren är inloggad, rendera den skyddade sidan
  return <>{children}</>;
};

export default ProtectedRoute;
