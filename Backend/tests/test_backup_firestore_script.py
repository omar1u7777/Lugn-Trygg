"""Tests for scripts.backup_firestore production safeguards and data handling."""

import importlib.util
import json
from pathlib import Path

MODULE_PATH = Path(__file__).resolve().parents[1] / "scripts" / "backup_firestore.py"
SPEC = importlib.util.spec_from_file_location("backup_firestore_script", MODULE_PATH)
assert SPEC and SPEC.loader
backup_firestore = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(backup_firestore)


class _FakeDoc:
    def __init__(self, doc_id: str, payload: dict):
        self.id = doc_id
        self._payload = payload

    def to_dict(self):
        return dict(self._payload)


class _FakeCollection:
    def __init__(self, docs: list[_FakeDoc]):
        self._docs = docs

    def stream(self):
        return list(self._docs)


class _FakeDocRef:
    def __init__(self, doc_id: str):
        self.doc_id = doc_id


class _FakeCollectionRef:
    def document(self, doc_id: str):
        return _FakeDocRef(doc_id)


class _FakeBatch:
    def __init__(self):
        self.ops: list[tuple[str, dict]] = []
        self.commit_count = 0

    def set(self, doc_ref: _FakeDocRef, data: dict):
        self.ops.append((doc_ref.doc_id, data))

    def commit(self):
        self.commit_count += 1


class _FakeRestoreDb:
    def __init__(self):
        self.batches: list[_FakeBatch] = []

    def collection(self, _name: str):
        return _FakeCollectionRef()

    def batch(self):
        batch = _FakeBatch()
        self.batches.append(batch)
        return batch


class _FakeBackupDb:
    def __init__(self, docs: list[_FakeDoc]):
        self._docs = docs

    def collection(self, _name: str):
        return _FakeCollection(self._docs)


def test_backup_collection_writes_utf8_json(tmp_path: Path, monkeypatch):
    docs = [
        _FakeDoc("doc-1", {"name": "Åsa"}),
        _FakeDoc("doc-2", {"value": 42}),
    ]
    monkeypatch.setattr(backup_firestore, "_get_db", lambda: _FakeBackupDb(docs))

    result = backup_firestore.backup_collection("users", tmp_path)

    assert result["collection"] == "users"
    assert result["documents"] == 2
    backup_file = Path(result["filename"])
    assert backup_file.exists()

    with open(backup_file, encoding="utf-8") as f:
        payload = json.load(f)

    assert payload[0]["_id"] == "doc-1"
    assert payload[0]["name"] == "Åsa"


def test_restore_collection_batches_and_strips_internal_id(tmp_path: Path, monkeypatch):
    backup_file = tmp_path / "users_restore.json"
    backup_payload = [
        {"_id": f"doc-{i}", "field": i} for i in range(501)
    ]
    backup_payload.append({"field": "missing-id"})
    backup_file.write_text(json.dumps(backup_payload), encoding="utf-8")

    fake_db = _FakeRestoreDb()
    monkeypatch.setattr(backup_firestore, "_get_db", lambda: fake_db)

    result = backup_firestore.restore_collection("users", backup_file)

    assert result["status"] == "success"
    assert result["documents"] == 501

    total_commits = sum(batch.commit_count for batch in fake_db.batches)
    assert total_commits == 2

    all_payloads = [payload for batch in fake_db.batches for _, payload in batch.ops]
    assert all("_id" not in payload for payload in all_payloads)


def test_restore_collection_rejects_invalid_backup_structure(tmp_path: Path, monkeypatch):
    invalid_backup = tmp_path / "invalid.json"
    invalid_backup.write_text(json.dumps({"not": "a-list"}), encoding="utf-8")

    monkeypatch.setattr(backup_firestore, "_get_db", lambda: _FakeRestoreDb())

    result = backup_firestore.restore_collection("users", invalid_backup)

    assert result["status"] == "failed"
    assert "expected a JSON array" in result["error"]


def test_main_restore_requires_force(monkeypatch, tmp_path: Path):
    backup_file = tmp_path / "users.json"
    backup_file.write_text("[]", encoding="utf-8")

    import src.firebase_config as firebase_config

    monkeypatch.setattr(backup_firestore, "initialize_firebase", lambda: None)
    monkeypatch.setattr(firebase_config, "db", object())
    monkeypatch.setattr(
        backup_firestore.argparse.ArgumentParser,
        "parse_args",
        lambda self: type("Args", (), {
            "collection": None,
            "output_dir": str(tmp_path),
            "restore": str(backup_file),
            "restore_collection": "users",
            "force": False,
        })(),
    )

    assert backup_firestore.main() == 1


def test_main_single_collection_returns_nonzero_on_failure(monkeypatch, tmp_path: Path):
    import src.firebase_config as firebase_config

    monkeypatch.setattr(backup_firestore, "initialize_firebase", lambda: None)
    monkeypatch.setattr(firebase_config, "db", object())
    monkeypatch.setattr(
        backup_firestore.argparse.ArgumentParser,
        "parse_args",
        lambda self: type("Args", (), {
            "collection": "users",
            "output_dir": str(tmp_path),
            "restore": None,
            "restore_collection": None,
            "force": False,
        })(),
    )
    monkeypatch.setattr(
        backup_firestore,
        "backup_collection",
        lambda _collection, _output_dir: {"collection": "users", "error": "boom"},
    )

    assert backup_firestore.main() == 1
