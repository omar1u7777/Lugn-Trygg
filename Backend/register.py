import os
import logging
from flask import Flask, request, jsonify
import firebase_admin
from firebase_admin import credentials, auth
from dotenv import load_dotenv

# 🔹 Lägg till import för CORS
from flask_cors import CORS

# 🔹 Ladda miljövariabler från .env
load_dotenv()

# 🔹 Konfigurera loggning
logging.basicConfig(level=logging.INFO)

# 🔹 Hämta Firebase-credentials från miljövariabel
cred_path = os.getenv("FIREBASE_CREDENTIALS")

if not cred_path:
    logging.error("❌ FIREBASE_CREDENTIALS saknas i .env!")
    raise ValueError("FIREBASE_CREDENTIALS saknas i .env!")

if not os.path.exists(cred_path):
    logging.error(f"❌ FEL: Filen {cred_path} hittades inte!")
    raise FileNotFoundError(f"Filen {cred_path} hittades inte!")

# 🔹 Initiera Firebase endast om det inte redan är initialiserat
if not firebase_admin._apps:
    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred)

# 🔹 Starta Flask-applikationen
app = Flask(__name__)

# 🔹 Aktivera CORS för samtliga rutter
#    (om du bara vill tillåta anrop från en specifik port, specificera origins)
CORS(app)

@app.route("/", methods=["GET"])
def index():
    """En enkel startsida för att visa att servern är igång."""
    return jsonify({"message": "Välkommen till Flask-backenden!"})

@app.route("/register", methods=["POST"])
def register_user():
    """ API-endpoint för att registrera användare i Firebase """
    try:
        # 🔹 Kontrollera att request innehåller JSON
        if not request.is_json:
            return jsonify({"error": "Endast JSON-format accepteras!"}), 415

        data = request.get_json()
        email = data.get("email", "").strip()
        password = data.get("password", "").strip()

        # 🔹 Grundläggande validering
        if not email or not password:
            return jsonify({"error": "E-post och lösenord krävs!"}), 400

        if len(password) < 8:
            return jsonify({"error": "Lösenordet måste vara minst 8 tecken!"}), 400

        # 🔹 Försök skapa användare i Firebase Authentication
        user = auth.create_user(email=email, password=password)
        logging.info(f"✅ Användare {email} registrerad med UID: {user.uid}")
        return jsonify({"message": "Registrering lyckades!", "uid": user.uid}), 201

    except firebase_admin.auth.EmailAlreadyExistsError:
        return jsonify({"error": "E-postadressen används redan!"}), 400
    except Exception as e:
        logging.error(f"🔥 Okänt fel vid registrering: {str(e)}")
        return jsonify({"error": "Ett internt serverfel uppstod"}), 500

if __name__ == "__main__":
    # 🔹 Kör servern på port 5001 i debug-läge
    app.run(debug=True, host="127.0.0.1", port=5001)
