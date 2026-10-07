"""
Reopen an account its owner deleted, within the 30-day grace period.

The delete dialog tells people that support can restore the account if they
change their mind before it is erased. Only act on a request sent from the
account's registered e-mail address.

Usage:
  python scripts/restore_deleted_account.py <registered_email>
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.firebase_config import auth  # noqa: E402
from src.services.account_erasure import restore_account  # noqa: E402


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    if auth is None:
        print("Firebase is not initialised. Check the service account configuration.")
        return 1

    # The profile's e-mail was anonymised at deletion; the sign-in record
    # still has the real one, and is how the request can be matched.
    try:
        user_id = auth.get_user_by_email(sys.argv[1]).uid
    except Exception as exc:
        print(f"No sign-in record for that address ({type(exc).__name__}).")
        return 1

    try:
        result = restore_account(user_id)
    except (LookupError, ValueError) as exc:
        print(f"Not restored: {exc}")
        return 1

    print(f"Restored {result['email']}. Display name and emergency contacts were cleared "
          "at deletion; ask the owner to re-enter them.")
    return 0


if __name__ == '__main__':
    sys.exit(main())
