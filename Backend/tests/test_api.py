import io
from unittest.mock import MagicMock

from Backend.src.services import auth_service


def test_register(client, monkeypatch):
    user_obj = MagicMock(uid="abc")
    monkeypatch.setattr(auth_service.auth, "create_user", lambda email, password: user_obj)
    resp = client.post("/api/auth/register", json={"email": "a@example.com", "password": "secret123"})
    assert resp.status_code == 201


def test_login(client, monkeypatch):
    user_obj = MagicMock(uid="abc", email="a@example.com")
    monkeypatch.setattr(auth_service.auth, "get_user_by_email", lambda email: user_obj)

    class Resp:
        status_code = 200
        def json(self):
            return {"idToken": "id", "refreshToken": "ref"}
    monkeypatch.setattr(auth_service.requests, "post", lambda *a, **k: Resp())

    fake_doc = MagicMock()
    fake_doc.id = "abc"
    fake_doc.to_dict.return_value = {"email_punycode": "a@example.com"}

    fake_query = MagicMock()
    fake_query.stream.return_value = [fake_doc]
    fake_query.limit.return_value = fake_query
    fake_query.where.return_value = fake_query

    def collection(name):
        if name == "users":
            users = MagicMock()
            users.where.return_value = fake_query
            users.document.return_value = MagicMock(update=MagicMock(), set=MagicMock())
            return users
        elif name == "refresh_tokens":
            tokens = MagicMock()
            tokens.document.return_value = MagicMock(set=MagicMock())
            return tokens
        else:
            return MagicMock()

    fake_db = MagicMock()
    fake_db.collection.side_effect = collection

    import Backend.src.routes.auth as auth_routes
    monkeypatch.setattr(auth_routes, "db", fake_db, raising=False)
    monkeypatch.setattr(auth_service, "db", fake_db, raising=False)

    resp = client.post("/api/auth/login", json={"email": "a@example.com", "password": "secret123"})
    assert resp.status_code == 200
    assert "access_token" in resp.get_json()


def test_log_mood(client):
    app = client.application
    app.config["TRANSCRIBE_MODEL"].transcribe.return_value = {"text": "jag är glad"}
    data = {
        "user_email": "a@example.com",
        "audio": (io.BytesIO(b"abc"), "test.wav")
    }
    resp = client.post("/api/mood/log", data=data, content_type="multipart/form-data")
    assert resp.status_code == 200
    assert resp.get_json()["mood"] == "glad"


def test_get_moods(client):
    app = client.application
    mock_doc = MagicMock()
    mock_doc.to_dict.return_value = {"mood": "glad", "timestamp": "t"}
    app.config["FIRESTORE_DB"].collection.return_value.document.return_value.collection.return_value.order_by.return_value.stream.return_value = [mock_doc]
    resp = client.get("/api/mood/get?user_email=a@example.com")
    assert resp.status_code == 200
    assert resp.get_json()["moods"][0]["mood"] == "glad"
