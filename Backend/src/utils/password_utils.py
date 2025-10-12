import bcrypt
import logging

logger = logging.getLogger(__name__)

# 🔹 Standard cost factor (säkerhet vs prestanda)
COST_FACTOR = 12  # Rekommenderat: 12-14 för optimal säkerhet och prestanda

def hash_password(password: str) -> str:
    """
    🔹 Hashar ett lösenord med bcrypt.
    
    Args:
        password (str): Det lösenord som ska hashas.

    Returns:
        str: Det hashade lösenordet som en sträng.

    Raises:
        ValueError: Om hashningen misslyckas.
    """
    try:
        salt = bcrypt.gensalt(rounds=COST_FACTOR)  # 🔹 Genererar en säker salt
        hashed_password = bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")
        return hashed_password
    except Exception as e:
        logger.exception(f"🔥 Fel vid lösenordshashning: {str(e)}")
        raise ValueError("Ett fel uppstod vid hashning av lösenord.")

def verify_password(password: str, hashed: str) -> bool:
    """
    🔹 Verifierar om ett lösenord matchar en hash.

    Args:
        password (str): Lösenordet som ska verifieras.
        hashed (str): Den hashade versionen av lösenordet.

    Returns:
        bool: True om lösenordet matchar, annars False.
    """
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception as e:
        logger.warning(f"⚠️ Fel vid lösenordsverifiering: {str(e)}")
        return False

def validate_password(password: str) -> bool:
    """
    🔹 Validerar lösenordsstyrka enligt säkerhetskrav.

    Args:
        password (str): Lösenordet som ska valideras.

    Returns:
        bool: True om lösenordet uppfyller kraven, annars False.
    """
    if len(password) < 8:
        return False
    if not any(char.isdigit() for char in password):
        return False
    if not any(char.isupper() for char in password):
        return False
    if not any(char.islower() for char in password):
        return False
    return True

# 🔹 Testa funktionen (kan tas bort i produktion)
if __name__ == "__main__":
    test_password = "Lösenord123!"
    hashed_pw = hash_password(test_password)
    print(f"🔐 Hashat lösenord: {hashed_pw}")
    
    # 🔹 Verifieringstest
    is_valid = verify_password(test_password, hashed_pw)
    print(f"✅ Lösenordsverifiering: {'Lyckades' if is_valid else 'Misslyckades'}")
