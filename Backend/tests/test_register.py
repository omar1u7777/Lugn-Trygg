import pytest
from flask import Flask
from register import app  # Importera din Flask-app från register.py
import json

@pytest.fixture
def client():
    # Testklient för Flask
    app.testing = True
    with app.test_client() as client:
        yield client

def test_register_ok(client):
    # Skicka ett POST-anrop till /register med JSON-data
    response = client.post(
        "/register",
        data=json.dumps({"email": "test@example.com", "password": "abcdefgh"}), 
        content_type="application/json"
    )
    # Kontrollera att vi får 201 Created
    assert response.status_code == 201
    data = response.get_json()
    assert data["message"] == "Registrering lyckades!"
