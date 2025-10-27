import os
import logging
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, auth, firestore, storage, exceptions

# 🔹 Ladda miljövariabler från .env
load_dotenv()

# 🔹 Konfigurera loggning
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

def get_env_variable(var_name: str, default=None, required=False, hide_value=False, cast_type=str):
    """
    Hämtar en miljövariabel och kastar fel om den saknas (om `required=True`).
    
    Args:
        var_name (str): Namnet på miljövariabeln.
        default: Standardvärde om variabeln saknas.
        required (bool): Om True kastas ett fel om variabeln saknas.
        hide_value (bool): Om True loggas inte värdet av variabeln.
        cast_type (type): Datatyp som variabeln ska omvandlas till.

    Returns:
        cast_type: Värdet av miljövariabeln i angiven datatyp.
    """
    value = os.getenv(var_name, default)

    if required and (value is None or str(value).strip() == ""):
        logger.critical(f"❌ Miljövariabel '{var_name}' saknas och är obligatorisk! Kontrollera din .env-fil.")
        raise ValueError(f"Miljövariabel '{var_name}' saknas och är obligatorisk!")

    try:
        if cast_type == bool:
            value = str(value).strip().lower() in ["1", "true", "yes"]
        elif cast_type == int:
            value = int(str(value).strip())
        elif cast_type == float:
            value = float(str(value).strip())
        elif cast_type == str:
            value = str(value).strip()
    except ValueError:
        logger.critical(f"❌ Miljövariabel '{var_name}' har fel format och kunde inte omvandlas till {cast_type.__name__}.")
        raise ValueError(f"Miljövariabel '{var_name}' har fel format och kunde inte omvandlas till {cast_type.__name__}.")

    # Logga inte känsliga värden
    log_value = "***" if hide_value else value
    logger.info(f"🔹 Laddad miljövariabel: {var_name} = {log_value}")

    return value

def initialize_firebase() -> bool:
    try:
        if firebase_admin._apps:
            logger.info("✅ Firebase är redan initierat.")
            return True

        cred_path_raw = get_env_variable("FIREBASE_CREDENTIALS", required=True)
        cred_path_raw = str(cred_path_raw).strip()
        
        # Check if it's a JSON string (starts with {) or a filepath
        if cred_path_raw.startswith("{"):
            # It's a JSON string from Render env - parse and write to temp file
            import json
            import tempfile
            try:
                creds_json = json.loads(cred_path_raw)
                with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as tf:
                    json.dump(creds_json, tf)
                    cred_path = tf.name
                logger.info(f"🔹 Firebase credentials från JSON env-variabel - sparad till {cred_path}")
            except json.JSONDecodeError as e:
                logger.error(f"❌ Kunde inte parse Firebase credentials JSON: {e}")
                raise ValueError(f"Invalid Firebase credentials JSON: {e}") from e
        else:
            # It's a filepath - process normally
            cred_path = cred_path_raw
            
            # Om sökvägen är relativ, gör den absolut baserat på Backend-katalogen
            if not os.path.isabs(cred_path):
                backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
                cred_path = os.path.join(backend_dir, cred_path)
                logger.info(f"🔹 Konverterade relativ sökväg till absolut: {cred_path}")
        
        if not os.path.exists(cred_path):
            raise FileNotFoundError(f"❌ Firebase credentials-filen saknas: {cred_path}. Kontrollera sökvägen!")

        # Försök att läsa filen
        try:
            with open(cred_path, "r") as f:
                f.read()  # Kontrollera att filen kan läsas
        except Exception as e:
            logger.critical(f"❌ Firebase credentials-filen kunde inte läsas: {e}")
            raise FileNotFoundError(f"Firebase credentials-filen kunde inte läsas: {e}")

        # Initiera Firebase med credentials
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
        logger.info("✅ Firebase-initialisering lyckades!")
        return True

    except exceptions.FirebaseError as fe:
        logger.exception(f"🔥 Firebase-specifikt initieringsfel: {str(fe)}")
        raise RuntimeError(f"Firebase kunde inte initieras: {str(fe)}") from fe
    except Exception as e:
        logger.exception(f"🔥 Kritiskt fel vid Firebase-initiering: {str(e)}")
        raise RuntimeError(f"Firebase-initialisering misslyckades: {str(e)}") from e

def get_firebase_services() -> dict:
    if not firebase_admin._apps:
        raise RuntimeError("❌ Firebase är inte initierat. Kör initialize_firebase() först.")

    try:
        return {
            "auth": auth,
            "db": firestore.client(),
            "storage": storage,
        }
    except Exception as e:
        logger.exception(f"🔥 Fel vid hämtning av Firebase-tjänster: {e}")
        raise RuntimeError("Kunde inte hämta Firebase-tjänster. Kontrollera konfigurationen.") from e

# Ensure exported names exist even if initialization fails
db = None
auth = None
firebase_admin_auth = None

# 🔹 Försök att initiera Firebase och hämta tjänster
try:
    if initialize_firebase():
        firebase_services = get_firebase_services()
        db = firebase_services["db"]
        auth = firebase_services["auth"]
        firebase_admin_auth = auth  # Alias for easier import
        logger.info("✅ Firebase-tjänster laddades framgångsrikt!")
except RuntimeError as e:
    # Do not raise here; instead expose None values so the application can run in a degraded
    # local development mode where Firebase admin credentials are not present.
    logger.critical(f"🚨 Firebase kunde inte startas: {e}")
    logger.warning("⚠️ Kör i lokal degraderad läge - Firebase-admin är inte initierat. Endast begränsad funktionalitet är tillgänglig.")
