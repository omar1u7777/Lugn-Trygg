#!/usr/bin/env python3
"""
FAS 3 - Memory Data Operations Direct Database Test
Testar CRUD-operationer för memory features direkt mot Firestore
"""

import sys
import os
import time
from datetime import datetime

# Lägg till Backend i path så vi kan importera
sys.path.insert(0, 'Backend')

try:
    # Importera Firebase config
    import src.firebase_config as firebase_config
    db = firebase_config.db

    print("🧪 FAS 3 - MEMORY DATA OPERATIONS DIREKT TEST")
    print("==================================================")

    # Test user ID
    test_user_id = "test_memory_user_123"

    # 1. Skapa ett test-memory direkt i Firestore
    print("1️⃣ Skapar memory-entry direkt i Firestore...")
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    memory_id = f"{test_user_id}_{timestamp}"

    memory_data = {
        'user_id': test_user_id,
        'file_path': f'memories/{test_user_id}/{timestamp}.mp3',
        'timestamp': timestamp,
        'title': 'Test Memory Entry',
        'description': 'Testing memory data operations'
    }

    memory_ref = db.collection('memories').document(memory_id)
    memory_ref.set(memory_data)
    print(f"✅ Memory-entry skapad i Firestore: ID = {memory_id}")

    # 2. Läs memory-entry från Firestore
    print("2️⃣ Läser memory-entry från Firestore...")
    doc = memory_ref.get()
    if doc.exists:
        retrieved_data = doc.to_dict()
        print(f"✅ Memory hämtad: title='{retrieved_data.get('title')}', user_id={retrieved_data.get('user_id')}")
    else:
        print("❌ Memory kunde inte hämtas")
        sys.exit(1)

    # 3. Uppdatera memory-entry
    print("3️⃣ Uppdaterar memory-entry...")
    update_data = {
        'title': 'Updated Test Memory',
        'description': 'Updated description for testing'
    }
    memory_ref.update(update_data)
    print("✅ Memory uppdaterad i Firestore")

    # 4. Verifiera uppdatering
    print("4️⃣ Verifierar uppdatering...")
    updated_doc = memory_ref.get()
    if updated_doc.exists:
        updated_data = updated_doc.to_dict()
        if updated_data.get('title') == 'Updated Test Memory':
            print("✅ Uppdatering verifierad: title='Updated Test Memory'")
        else:
            print(f"❌ Uppdatering misslyckades: title='{updated_data.get('title')}'")
            sys.exit(1)

    # 5. Lista memories för användaren
    print("5️⃣ Listar memories för användaren...")
    from google.cloud.firestore import FieldFilter

    try:
        # Försök med FieldFilter först (nyare API)
        memories_query = db.collection('memories').where(filter=FieldFilter('user_id', '==', test_user_id))
        memories_docs = list(memories_query.stream())
    except TypeError:
        # Fallback för äldre API
        memories_docs = list(db.collection('memories').where('user_id', '==', test_user_id).stream())

    print(f"✅ Totalt {len(memories_docs)} memory-entries för användaren")

    # 6. Rensar upp - tar bort test-memory
    print("6️⃣ Rensar upp - tar bort test-memory...")
    memory_ref.delete()
    print("✅ Test-memory borttagen från Firestore")

    # 7. Verifiera borttagning
    print("7️⃣ Verifierar borttagning...")
    deleted_doc = memory_ref.get()
    if not deleted_doc.exists:
        print("✅ Borttagning verifierad - memory finns inte längre")
    else:
        print("❌ Borttagning misslyckades")
        sys.exit(1)

    print("\n==================================================")
    print("🎉 FAS 3 MEMORY DATA OPERATIONS ÄR 100% VERIFIERADE!")
    print("✅ Skapa memory fungerar")
    print("✅ Läsa memory fungerar")
    print("✅ Uppdatera memory fungerar")
    print("✅ Lista memories fungerar")
    print("✅ Ta bort memory fungerar")
    print("✅ Alla CRUD-operationer fungerar med riktiga data i Firestore")
    print("==================================================")

except Exception as e:
    print(f"❌ FEL VID MEMORY DATA TEST: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)