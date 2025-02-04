"""
Detta är en modul för att hantera applikationskonfiguration och verifiering.
"""

import os
from dotenv import load_dotenv

# Ladda miljövariabler från .env-fil
load_dotenv()

# Autentiseringsuppgifter
FIREBASE_CREDENTIALS = os.getenv("FIREBASE_CREDENTIALS")
PORCUPINE_ACCESS_KEY = os.getenv("089e6b34270e17f8c217c9f9fa2cda5a8ad2754c")

# Applikationsinställningar
WAKE_WORD = "hej"
LANGUAGE = "sv-SE"
AUDIO_DIR = "audio"
MAX_ATTEMPTS = 3
LOG_LEVEL = "INFO"

# Ljudinställningar
AUDIO_SETTINGS = {
    "sampling_rate": 44100,
    "channels": 1,
    "format": "paInt16",
    "buffer_size": 1024
}

def verifiera_konfiguration():
    """Säkerställer att alla nödvändiga mappar finns"""
    required_dirs = [AUDIO_DIR, "memories"]
    for directory in required_dirs:
        os.makedirs(directory, exist_ok=True)