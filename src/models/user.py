from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Optional, Dict

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

    def to_dict(self) -> Dict[str, str]:
        """🔹 Konverterar User-objekt till dictionary (t.ex. för Firestore-lagring)."""
        return {
            "uid": self.uid,
            "email": self.email,
            "created_at": self.created_at.isoformat(),
            "last_login": self.last_login.isoformat() if self.last_login else None,
            "email_verified": self.email_verified
        }

    @staticmethod
    def from_dict(data: Dict[str, str]) -> "User":
        """🔹 Skapar en User-instans från en dictionary (t.ex. Firestore-data)."""
        return User(
            uid=data["uid"],
            email=data["email"],
            created_at=datetime.fromisoformat(data["created_at"]) if "created_at" in data else datetime.now(timezone.utc),
            last_login=datetime.fromisoformat(data["last_login"]) if data.get("last_login") else None,
            email_verified=data.get("email_verified", False)
        )
