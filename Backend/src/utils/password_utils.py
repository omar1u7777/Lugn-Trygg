import logging

import bcrypt

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
        raise ValueError("Ett fel uppstod vid hashning av lösenord.") from e

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

def check_password_strength(password: str) -> dict:
    """
    🔹 Kontrollerar lösenordsstyrka och returnerar detaljerad analys.

    Args:
        password (str): Lösenordet som ska analyseras.

    Returns:
        dict: En dictionary med styrkeanalys.
    """
    score = 0
    feedback = []

    if len(password) >= 8:
        score += 1
    else:
        feedback.append("Lösenordet måste vara minst 8 tecken långt.")

    if any(char.isdigit() for char in password):
        score += 1
    else:
        feedback.append("Lösenordet måste innehålla minst en siffra.")

    if any(char.isupper() for char in password):
        score += 1
    else:
        feedback.append("Lösenordet måste innehålla minst en stor bokstav.")

    if any(char.islower() for char in password):
        score += 1
    else:
        feedback.append("Lösenordet måste innehålla minst en liten bokstav.")

    if any(char in "!@#$%^&*()_+-=[]{}|;:,.<>?" for char in password):
        score += 1
    else:
        feedback.append("Lösenordet bör innehålla minst ett specialtecken.")

    strength = "Svagt"
    if score >= 4:
        strength = "Starkt"
    elif score >= 3:
        strength = "Medel"

    return {
        "score": score,
        "strength": strength,
        "feedback": feedback,
        "is_valid": score >= 4
    }

# Test function - only runs when file is executed directly
if __name__ == "__main__":
    import logging
    import os

    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)
    # Use environment variable or generate test password securely
    test_password = os.getenv("TEST_PASSWORD", "TestP@ssw0rd!")  # nosec B105
    hashed_pw = hash_password(test_password)
    logger.info("🔐 Hashat lösenord: %s", hashed_pw)

    # Verification test
    is_valid = verify_password(test_password, hashed_pw)
    logger.info("✅ Lösenordsverifiering: %s", "Lyckades" if is_valid else "Misslyckades")
