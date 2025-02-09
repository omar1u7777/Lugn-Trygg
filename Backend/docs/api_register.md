# API-Dokumentation - Registreringsendpoint

## Endpoint: `/register`

### **Beskrivning**

Denna endpoint används för att registrera en ny användare med e-post och lösenord i Firebase Authentication.

---

## **HTTP Request**

**Metod:** `POST`

**URL:** `http://127.0.0.1:5000/register`

---

## **Request Body (JSON-format)**

**Obligatoriska fält:**

```json
{
    "email": "testuser@example.com",
    "password": "hemligtLosenord123"
}
```

| Fält     | Typ | Beskrivning                           |
| -------- | --- | ------------------------------------- |
| email    | str | Användarens e-postadress              |
| password | str | Användarens lösenord (minst 8 tecken) |

---

## **Respons**

### ✅ **Lyckad registrering**

**HTTP Status:** `201 Created`

```json
{
    "message": "Registrering lyckades!",
    "uid": "ABC123DEF456..."
}
```

### ❌ **Felmeddelanden**

| HTTP Status                 | Felmeddelande                                          | Orsak                                     |
| --------------------------- | ------------------------------------------------------ | ----------------------------------------- |
| `400 Bad Request`           | `{ "error": "E-post och lösenord krävs!" }`            | Om något av fälten saknas                 |
| `400 Bad Request`           | `{ "error": "Lösenordet måste vara minst 8 tecken!" }` | Om lösenordet är för kort                 |
| `400 Bad Request`           | `{ "error": "E-postadressen används redan!" }`         | Om e-postadressen redan finns registrerad |
| `500 Internal Server Error` | `{ "error": "Ett internt fel uppstod." }`              | Om något oväntat går fel                  |

---

## **Exempel på anrop i PowerShell**

Om du vill testa registreringen via PowerShell:

```powershell
$body = @{
    email = "testuser@example.com"
    password = "hemligtLosenord123"
} | ConvertTo-Json -Compress

Invoke-RestMethod -Uri "http://127.0.0.1:5000/register" -Method Post -Body $body -ContentType "application/json"
```

---

##

