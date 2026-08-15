"""Tests for src/utils/secure_pickle.py.

pickle.loads executes arbitrary code, so anything able to write to a model
directory gets RCE in a process holding Firestore credentials. MoodPredictor
loaded two .pkl files from MODEL_PATH with no verification at all while
MLSentimentService already had an HMAC guard; this module is that guard
extracted so both share it.
"""

import pickle

import pytest

from src.utils import secure_pickle
from src.utils.secure_pickle import (
    PickleIntegrityError,
    dump_signed,
    load_verified,
    sign_bytes,
)


@pytest.fixture(autouse=True)
def _fixed_key(monkeypatch):
    """Pin the signing key so signatures are stable across cases."""
    monkeypatch.setenv("ENCRYPTION_KEY", "test-key-for-signing-pickles")
    secure_pickle.reset_key_cache()
    yield
    secure_pickle.reset_key_cache()


def test_round_trip(tmp_path):
    path = tmp_path / "model.pkl"
    payload = {"weights": [1, 2, 3], "version": "1.0.0"}

    dump_signed(payload, path)

    assert load_verified(path) == payload


def test_rejects_unsigned_pickle(tmp_path):
    """A plain pickle.dump — what the old MoodPredictor path loaded blindly."""
    path = tmp_path / "unsigned.pkl"
    path.write_bytes(pickle.dumps({"weights": [1, 2, 3]}))

    with pytest.raises(PickleIntegrityError):
        load_verified(path)


def test_rejects_tampered_payload(tmp_path):
    path = tmp_path / "model.pkl"
    dump_signed({"weights": [1, 2, 3]}, path)

    raw = bytearray(path.read_bytes())
    raw[0] ^= 0xFF  # flip a bit in the payload, leave the signature intact
    path.write_bytes(bytes(raw))

    with pytest.raises(PickleIntegrityError):
        load_verified(path)


def test_rejects_tampered_signature(tmp_path):
    path = tmp_path / "model.pkl"
    dump_signed({"weights": [1, 2, 3]}, path)

    raw = bytearray(path.read_bytes())
    raw[-1] ^= 0xFF
    path.write_bytes(bytes(raw))

    with pytest.raises(PickleIntegrityError):
        load_verified(path)


def test_rejects_file_too_small_to_hold_a_signature(tmp_path):
    path = tmp_path / "tiny.pkl"
    path.write_bytes(b"short")

    with pytest.raises(PickleIntegrityError):
        load_verified(path)


def test_never_deserializes_before_verifying(tmp_path, monkeypatch):
    """The signature check must gate pickle.loads, not follow it."""
    path = tmp_path / "unsigned.pkl"
    path.write_bytes(pickle.dumps({"weights": [1]}))

    called = False

    def _tripwire(*_args, **_kwargs):
        nonlocal called
        called = True
        return {}

    monkeypatch.setattr(secure_pickle.pickle, "loads", _tripwire)

    with pytest.raises(PickleIntegrityError):
        load_verified(path)

    assert called is False, "pickle.loads ran on an unverified payload"


def test_signature_changes_with_key(tmp_path, monkeypatch):
    payload = pickle.dumps({"a": 1})
    first = sign_bytes(payload)

    monkeypatch.setenv("ENCRYPTION_KEY", "a-completely-different-key")
    secure_pickle.reset_key_cache()
    second = sign_bytes(payload)

    assert first != second


def test_file_signed_with_another_key_is_rejected(tmp_path, monkeypatch):
    path = tmp_path / "model.pkl"
    dump_signed({"weights": [1, 2, 3]}, path)

    monkeypatch.setenv("ENCRYPTION_KEY", "rotated-key")
    secure_pickle.reset_key_cache()

    with pytest.raises(PickleIntegrityError):
        load_verified(path)
