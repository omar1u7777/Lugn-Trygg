import firebase_admin
from firebase_admin import credentials, firestore, auth

# Initiera Firebase
cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(cred)

# Firestore-databas
db = firestore.client()

def test_firestore():
    """Testa att Firestore är ansluten och kan skriva/läsa data"""
    try:
        doc_ref = db.collection("test").document("check")
        doc_ref.set({"message": "Firebase Firestore fungerar!"})
        doc = doc_ref.get()
        print("✅ Firestore:", doc.to_dict())
    except Exception as e:
        print(f"❌ Firestore-fel: {e}")

def test_authentication():
    """Testa att skapa och hämta en användare i Firebase Authentication"""
    try:
        email = "testuser@example.com"
        password = "TestPassword123"

        # Skapa en testanvändare (om den inte redan finns)
        try:
            user = auth.create_user(email=email, password=password)
            print(f"✅ Användare skapad: {user.uid}")
        except firebase_admin.auth.EmailAlreadyExistsError:
            print("ℹ️ Användaren finns redan.")

        # Hämta användaren
        user = auth.get_user_by_email(email)
        print(f"✅ Användare hittades: {user.uid}")
    except Exception as e:
        print(f"❌ Inloggningsfel: {e}")

# Kör testerna
print("🔹 Testar Firestore...")
test_firestore()

print("🔹 Testar Firebase Authentication...")
test_authentication()
