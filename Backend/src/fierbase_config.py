import os
import logging
import firebase_admin
from firebase_admin import credentials, auth, firestore
from dotenv import load_dotenv

# Ladda miljövariabler från .env-filen
load_dotenv()

# Konfigurera logging för att ge tydliga och detaljerade meddelanden
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

def initialize_firebase() -> bool:
    """Initierar Firebase och returnerar True om det lyckas."""
    try:
        # Hämta sökvägen till Firebase service-kontot från miljövariabler
        cred_path = os.getenv("FIREBASE_CREDENTIALS", "serviceAccountKey.json")
        logger.info(f"Försöker ladda Firebase från: {cred_path}")

        # Kontrollera om serviceAccountKey.json-filen existerar
        if not os.path.exists(cred_path):
            raise FileNotFoundError(f"Firebase credentials saknas eller hittades inte: {cred_path}")

        # Initiera Firebase om det inte redan är gjort
        if not firebase_admin._apps:
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
            logger.info("Firebase-initialisering lyckades!")

        return True

    except Exception as e:
        # Logga och hantera kritiska fel vid Firebase-initiering
        logger.error(f"Fel vid Firebase-initiering: {str(e)}")
        return False

def get_firebase_services() -> dict:
    """Returnerar en dictionary med Firebase Authentication och Firestore-klienten."""
    try:
        if not firebase_admin._apps:
            raise RuntimeError("Firebase är inte initierat. Kör initialize_firebase() först.")

        # Returnera Firebase-tjänster
        return {
            "auth": auth,
            "db": firestore.client(),
        }

    except Exception as e:
        # Felhantering om Firebase-tjänster inte kan hämtas
        logger.error(f"Fel vid hämtning av Firebase-tjänster: {str(e)}")
        raise e

# Initiera Firebase-tjänster och tilldela dem till globala variabler
if initialize_firebase():
    firebase_services = get_firebase_services()
    db = firebase_services["db"]
    auth = firebase_services["auth"]

    logger.info("Firebase-tjänster laddades framgångsrikt!")
else:
    logger.error("Firebase-tjänster kunde inte initieras. Kontrollera loggarna för detaljer.")
