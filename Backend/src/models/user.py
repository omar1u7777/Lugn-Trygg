
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

@dataclass
class User:
    uid: str
    email: str
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    last_login: Optional[datetime] = None
    email_verified: bool = field(default=False)