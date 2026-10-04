"""Stable public pseudonyms for users shown to other users.

Leaderboards showed other users as a masked email ("om***7") or by their real
name. In a mental-health app, being recognisable as a user is itself the
sensitive fact, and a masked email is trivially linked back to the address
the person uses elsewhere.

An alias here is derived from the user id with a keyed hash, so it is:
- stable: the same person has the same name on every board and every visit;
- unlinkable: without the server secret, neither the id nor anything the
  person typed can be recovered from it, or matched to it.
"""

import hashlib
import hmac
import os

_ADJECTIVES = (
    'Lugn', 'Trygg', 'Modig', 'Stark', 'Varm', 'Snäll', 'Glad', 'Hoppfull',
    'Tålmodig', 'Kreativ', 'Positiv', 'Fridfull', 'Klok', 'Mjuk', 'Stilla', 'Ljus',
)
_NOUNS = (
    'Själ', 'Hjärta', 'Ande', 'Vän', 'Resenär', 'Drömmare', 'Lyssnare',
    'Berättare', 'Sökare', 'Vandrare', 'Stjärna', 'Våg', 'Skog', 'Fjäril', 'Älv', 'Gryning',
)

# Separates this derivation from every other use of the secret.
_CONTEXT = b'lugn-trygg/public-alias/v1'


def _key() -> bytes:
    secret = os.getenv('JWT_SECRET_KEY') or 'development-only-alias-key'
    return hmac.new(secret.encode(), _CONTEXT, hashlib.sha256).digest()


def public_alias(user_id: str) -> str:
    """'FridfullAnde644'-style name for `user_id`; 'Anonym' if there is none."""
    if not user_id:
        return 'Anonym'
    digest = hmac.new(_key(), user_id.encode(), hashlib.sha256).digest()
    adjective = _ADJECTIVES[digest[0] % len(_ADJECTIVES)]
    noun = _NOUNS[digest[1] % len(_NOUNS)]
    number = int.from_bytes(digest[2:4], 'big') % 900 + 100
    return f'{adjective}{noun}{number}'
