import importlib
import json
import sys
from pathlib import Path

import firebase_admin


def _ensure_backend_on_path() -> None:
    backend_root = Path(__file__).resolve().parent
    backend_root_str = str(backend_root)
    if backend_root_str not in sys.path:
        sys.path.insert(0, backend_root_str)


def test_initialize_firebase_accepts_utf8_bom_credentials_file(monkeypatch, tmp_path):
    _ensure_backend_on_path()

    cred_payload = {
        "type": "service_account",
        "project_id": "bom-test-project",
        "private_key_id": "key-id",
        "private_key": "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n",  # gitleaks:allow
        "client_email": "bom-test@bom-test-project.iam.gserviceaccount.com",
        "client_id": "1234567890",
        "token_uri": "https://oauth2.googleapis.com/token",
    }

    cred_file = tmp_path / "firebase_bom_credentials.json"
    cred_file.write_text(json.dumps(cred_payload), encoding="utf-8-sig")

    monkeypatch.setenv("FIREBASE_CREDENTIALS", str(cred_file))
    monkeypatch.setenv("FIREBASE_CREDENTIALS_PATH", str(cred_file))

    captured: dict[str, object] = {}

    def fake_certificate(value):
        captured["certificate_arg"] = value
        return {"certificate": value}

    def fake_initialize_app(_cred, _options=None):
        captured["initialize_called"] = True
        firebase_admin._apps = {"default": object()}  # type: ignore[attr-defined]
        return object()

    monkeypatch.setattr(firebase_admin, "_apps", {}, raising=False)
    monkeypatch.setattr("firebase_admin.credentials.Certificate", fake_certificate)
    monkeypatch.setattr("firebase_admin.initialize_app", fake_initialize_app)
    monkeypatch.setattr("firebase_admin.delete_app", lambda _app: None)
    monkeypatch.setattr("firebase_admin.get_app", lambda: object())
    monkeypatch.setattr("firebase_admin.firestore.client", lambda: object())

    sys.modules.pop("src.firebase_config", None)
    firebase_config = importlib.import_module("src.firebase_config")

    # Re-run explicitly to assert behavior independent of import side-effects.
    ok = firebase_config.initialize_firebase(force_reinitialize=True)

    assert ok is True
    assert captured.get("initialize_called") is True
    cert_arg = captured.get("certificate_arg")
    assert isinstance(cert_arg, dict)
    assert cert_arg.get("project_id") == "bom-test-project"
