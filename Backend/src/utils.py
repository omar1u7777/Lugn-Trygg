import idna

def convert_email_to_punycode(email: str) -> str:
    """
    Konverterar domänen i en e-postadress till Punycode-format.

    Punycode används för att hantera internationella domännamn (IDN) som innehåller icke-ASCII-tecken,
    t.ex. å, ä, ö. Detta säkerställer kompatibilitet med system som inte stöder dessa tecken.

    Notera: Den lokala delen (före "@") kodas inte, då den sällan innehåller icke-ASCII-tecken.
    Om detta är ett krav, behöver funktionen utökas.
    """
    if "@" not in email:
        raise ValueError("⚠️ Ogiltig e-postadress. '@' saknas.")

    try:
        local_part, domain = email.split("@")
        # Kodar endast domänen till Punycode
        encoded_domain = idna.encode(domain).decode("utf-8")
        return f"{local_part}@{encoded_domain}"  # Sätter ihop e-postadressen igen
    except Exception as e:
        raise ValueError(f"⚠️ Fel vid Punycode-konvertering: {str(e)}")