import firebase_admin
from firebase_admin import credentials, auth

# Ladda upp autentiseringsuppgifter från din serviceAccountKey.json
cred = credentials.Certificate("serviceAccountKey.json")

# Initiera Firebase endast om det inte redan är gjort
if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)

# Exportera auth för att kunna användas i andra filer
firebase_auth = auth
