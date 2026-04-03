# Secret Remediation Runbook

The legacy `api_keys/.master.key` file has been removed from reachable git history and must never be recreated. The API key rotation service now uses `API_KEY_ENCRYPTION_KEY` from the environment instead of a file on disk.

## Required actions

1. Set a new `API_KEY_ENCRYPTION_KEY` in the backend secret manager before using API key rotation in production.
2. If any `api_keys/*.key` files were encrypted with an older storage key, set `API_KEY_ENCRYPTION_KEY_PREVIOUS` temporarily so the service can decrypt and re-encrypt them under the new key.
3. After re-encryption is complete, remove `API_KEY_ENCRYPTION_KEY_PREVIOUS`.

## Safety rules

1. Never store `API_KEY_ENCRYPTION_KEY` in `.env` files committed to the repository.
2. Never recreate `api_keys/.master.key` or `Backend/api_keys/.master.key`.
3. Treat any previously exposed master key as permanently compromised.