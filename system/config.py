"""
Detta är en modul för att hantera applikationskonfiguration och verifiering.
"""

import os
from dotenv import load_dotenv

# Ladda miljövariabler från .env-fil
load_dotenv()

# Autentiseringsuppgifter
FIREBASE_CREDENTIALS = os.getenv("FIREBASE_CREDENTIALS")  # Sätt säkra autentiseringsuppgifter i .env-filen
PORCUPINE_ACCESS_KEY = os.getenv("PORCUPINE_ACCESS_KEY")  # Din Porcupine API-nyckel hämtas från miljövariabler

# Applikationsinställningar
WAKE_WORD = "hej"  # Aktiveringsfras för röstassistenten
LANGUAGE = "sv-SE"  # Språkinställning för röstigenkänning
AUDIO_DIR = "audio"  # Mapp för att lagra ljudfiler
MAX_ATTEMPTS = 3  # Max antal försök för att få ett korrekt röstkommando
LOG_LEVEL = "INFO"  # Standard loggningsnivå

# Ljudinställningar
AUDIO_SETTINGS = {
    "sampling_rate": 44100,  # Samplingsfrekvens för ljudinspelning
    "channels": 1,  # Antal ljudkanaler (mono)
    "format": "paInt16",  # Ljudformat
    "buffer_size": 1024  # Buffertstorlek för ljudströmning
}

def verifiera_konfiguration():
    """Säkerställer att alla nödvändiga mappar finns och miljövariabler är korrekt inställda"""
    required_dirs = [AUDIO_DIR, "memories"]
    for directory in required_dirs:
        os.makedirs(directory, exist_ok=True)

    if not FIREBASE_CREDENTIALS:
        raise EnvironmentError("FIREBASE_CREDENTIALS saknas i .env-filen")
    if not PORCUPINE_ACCESS_KEY:
        raise EnvironmentError("PORCUPINE_ACCESS_KEY saknas i .env-filen")
