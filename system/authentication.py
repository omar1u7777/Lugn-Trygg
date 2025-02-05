import firebase_admin
from firebase_admin import credentials, firestore
import bcrypt
import re
from datetime import datetime
from .config import FIREBASE_CREDENTIALS
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# 🔥 Firebase-initiering
def initiera_firebase() -> Optional[firestore.Client]:
    """Initierar Firebase-anslutning med autentiseringsuppgifter"""
    try:
        if not firebase_admin._apps:
            autentiseringsfil = credentials.Certificate(FIREBASE_CREDENTIALS)
            firebase_admin.initialize_app(autentiseringsfil)
        return firestore.client()
    except firebase_admin.exceptions.FirebaseError as fel:
        logger.error(f"Firebase-initieringsfel: {str(fel)}")
        return None

db = initiera_firebase()

# 🔐 Lösenordshashning
def hasha_lösenord(lösenord: str) -> str:
    """Returnerar ett säkert hashat lösenord"""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(lösenord.encode(), salt).decode()

def verifiera_lösenord(lösenord: str, hashat_lösenord: str) -> bool:
    """Verifierar att lösenordet matchar det hashade lösenordet"""
    return bcrypt.checkpw(lösenord.encode(), hashat_lösenord.encode())

# 📧 E-postvalidering
def validera_mejl(mejl: str) -> bool:
    """Kontrollerar om e-postadressen har korrekt format"""
    return re.match(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$", mejl) is not None

# 👤 Skapa nytt konto
def skapa_konto(mejl: str, lösenord: str) -> bool:
    """Skapar ett nytt användarkonto i Firebase"""
    if not validera_mejl(mejl):
        logger.warning("Ogiltig e-postadress angiven")
        return False

    try:
        användarref = db.collection("anvandare").document(mejl)
        
        if användarref.get().exists:
            logger.info("Kontot finns redan")
            return False
            
        användarref.set({
            "losenord": hasha_lösenord(lösenord),
            "skapad": datetime.now(),
            "senaste_inloggning": None,
            "humor_historik": []
        })
        logger.info("Konto skapat framgångsrikt")
        return True
        
    except firestore.FirestoreError as fel:
        logger.error(f"Kontoskapande fel: {str(fel)}")
        return False

# 🔑 Logga in användare
def logga_in(mejl: str, lösenord: str) -> bool:
    """Autentiserar användare mot Firebase"""
    try:
        användarref = db.collection("anvandare").document(mejl)
        användardok = användarref.get()
        
        if not användardok.exists:
            logger.warning("Användaren finns inte")
            return False
            
        användardata = användardok.to_dict()
        
        if verifiera_lösenord(lösenord, användardata["losenord"]):
            användarref.update({"senaste_inloggning": firestore.SERVER_TIMESTAMP})
            logger.info("Lyckad inloggning")
            return True
            
        logger.warning("Felaktigt lösenord")
        return False
        
    except firestore.FirestoreError as fel:
        logger.error(f"Inloggningsfel: {str(fel)}")
        return False
