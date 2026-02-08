from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Optional, Dict, Any, Union

from ..utils.timestamp_utils import parse_iso_timestamp

@dataclass
class User:
    uid: str
    email: str
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    last_login: Optional[datetime] = None
    email_verified: bool = field(default=False)

    def update_last_login(self):
        """🔹 Uppdatera senaste inloggningstid."""
        self.last_login = datetime.now(timezone.utc)

    def to_dict(self) -> Dict[str, Any]:
        """🔹 Konverterar User-objekt till dictionary (t.ex. för Firestore-lagring)."""
        return {
            "uid": self.uid,
            "email": self.email,
            "created_at": self.created_at.isoformat(),
            "last_login": self.last_login.isoformat() if self.last_login else None,
            "email_verified": self.email_verified
        }

    @staticmethod
    def from_dict(data: Dict[str, Any]) -> "User":
        """🔹 Skapar en User-instans från en dictionary (t.ex. Firestore-data)."""
        email_verified_raw = data.get("email_verified", False)
        email_verified = bool(email_verified_raw) if not isinstance(email_verified_raw, bool) else email_verified_raw
        
        return User(
            uid=data["uid"],
            email=data["email"],
            created_at=parse_iso_timestamp(data.get("created_at")),
            last_login=parse_iso_timestamp(data.get("last_login")) if data.get("last_login") else None,
            email_verified=email_verified
        )
