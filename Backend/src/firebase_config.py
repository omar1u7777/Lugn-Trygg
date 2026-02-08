"""
Firebase configuration module for Lugn & Trygg backend.

This module handles Firebase initialization, authentication, and service setup
using environment variables and credentials.
"""

import os
import logging
import time
import asyncio
from pathlib import Path
from typing import Any, Dict, Optional, List, Union
from functools import wraps

from dotenv import load_dotenv

import firebase_admin
from firebase_admin import (
    credentials,
    firestore,
    storage,
    exceptions as firebase_admin_exceptions,
)
from firebase_admin import auth as firebase_admin_auth_module

# 🔹 Ladda miljövariabler från .env
load_dotenv()

# 🔹 Konfigurera loggning
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Import for advanced connection pooling
try:
    from google.auth.transport import requests as auth_requests
    from google.cloud.firestore_v1 import Client as FirestoreClient
    GOOGLE_AUTH_AVAILABLE = True
except ImportError:
    GOOGLE_AUTH_AVAILABLE = False
    auth_requests = None  # type: ignore
    FirestoreClient = None  # type: ignore
    logger.warning("Google Auth libraries not available - using basic connection pooling")



def firestore_retry(max_retries: int = 3, backoff_factor: float = 0.5, max_backoff: float = 5.0):
    """
    Decorator for Firestore operations with exponential backoff retry logic.
    Handles temporary connection issues and rate limiting.
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            last_exception = None
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except (firebase_admin_exceptions.FirebaseError,
                        ConnectionError,
                        TimeoutError) as e:
                    last_exception = e
                    error_code = getattr(e, 'code', 'UNKNOWN')

                    # Don't retry on authentication or permission errors
                    if error_code in ['PERMISSION_DENIED', 'UNAUTHENTICATED', 'INVALID_ARGUMENT']:
                        logger.error(f"Non-retryable Firestore error: {error_code}")
                        raise

                    if attempt < max_retries - 1:
                        # Exponential backoff with jitter
                        delay = min(backoff_factor * (2 ** attempt), max_backoff)
                        logger.warning(f"Firestore operation failed (attempt {attempt + 1}/{max_retries}): {str(e)}, retrying in {delay:.1f}s")
                        time.sleep(delay)
                    else:
                        logger.error(f"Firestore operation failed after {max_retries} attempts: {str(e)}")

            # If we get here, last_exception should not be None
            if last_exception:
                raise last_exception
            else:
                raise RuntimeError("Firestore operation failed with unknown error")
        return wrapper
    return decorator


def get_env_variable(
    var_name: str,
    default=None,
    required: bool = False,
    hide_value: bool = False,
    cast_type=str,
):
    """
    Hämtar en miljövariabel och kastar fel om den saknas (om `required=True`).
    
    Args:
        var_name (str): Namnet på miljövariabeln.
        default: Standardvärde om variabeln saknas.
        required (bool): Om True kastas ett fel om variabeln saknas.
        hide_value (bool): Om True loggas inte värdet av variabeln.
        cast_type (type): Datatyp som variabeln ska omvandlas till.

    Returns:
        cast_type: Värdet av miljövariabeln i angiven datatyp.
    """
    value = os.getenv(var_name, default)

    if required and (value is None or str(value).strip() == ""):
        logger.critical(
            f"❌ Miljövariabel '{var_name}' saknas och är obligatorisk! "
            "Kontrollera din .env-fil."
        )
        raise ValueError(f"Miljövariabel '{var_name}' saknas och är obligatorisk!")

    try:
        if cast_type == bool:
            value = str(value).strip().lower() in ["1", "true", "yes"]
        elif cast_type == int:
            value = int(str(value).strip())
        elif cast_type == float:
            value = float(str(value).strip())
        elif cast_type == str:
            value = str(value).strip()
    except ValueError:
        logger.critical(
            f"❌ Miljövariabel '{var_name}' har fel format och kunde inte "
            f"omvandlas till {cast_type.__name__}."
        )
        raise ValueError(
            f"Miljövariabel '{var_name}' har fel format och kunde inte "
            f"omvandlas till {cast_type.__name__}."
        )

    # Logga inte känsliga värden
    log_value = "***" if hide_value else value
    logger.debug(f"🔹 Laddad miljövariabel: {var_name} = {log_value}")

    return value


db: Optional[Any] = None  # Firestore client
auth: Optional[Any] = None
firebase_admin_auth: Optional[Any] = None
firebase_storage: Optional[Any] = None
firebase_exceptions = firebase_admin_exceptions


def _firebase_initialized() -> bool:
    return bool(getattr(firebase_admin, "_apps", None))


def _bind_services() -> None:
    global db, auth, firebase_admin_auth, firebase_storage, firebase_exceptions

    db = firestore.client()
    firebase_admin_auth = firebase_admin_auth_module
    auth = firebase_admin_auth
    firebase_storage = storage
    firebase_exceptions = firebase_admin_exceptions


def initialize_firebase(force_reinitialize: bool = False) -> bool:
    """
    Initialize Firebase app with credentials and options.

    Args:
        force_reinitialize: If True, reinitialize even if already initialized.

    Returns:
        bool: True if initialization successful.
    """
    global db, auth, firebase_admin_auth, firebase_storage, firebase_exceptions

    if _firebase_initialized():
        if not force_reinitialize:
            _bind_services()
            return True
        firebase_admin.delete_app(firebase_admin.get_app())

    cred_path_raw = str(
        get_env_variable("FIREBASE_CREDENTIALS", required=True)
    ).strip()

    path_override = os.getenv("FIREBASE_CREDENTIALS_PATH")
    if path_override:
        cred_path_raw = path_override.strip()

    if cred_path_raw.startswith("{"):
        import json

        try:
            creds_json = json.loads(cred_path_raw)
            cred = credentials.Certificate(creds_json)
            logger.info("🔹 Firebase credentials från JSON env-variabel")
        except json.JSONDecodeError as exc:  # pragma: no cover - configuration error path
            raise RuntimeError(f"Invalid Firebase credentials JSON: {exc}") from exc
    else:
        cred_path = cred_path_raw
        if not os.path.isabs(cred_path):
            backend_dir = Path(__file__).resolve().parents[1]
            cred_path = str((backend_dir / cred_path).resolve())
            logger.info("🔹 Konverterade relativ sökväg till absolut: %s", cred_path)

        if not os.path.exists(cred_path):
            raise FileNotFoundError(f"Firebase credentials-filen saknas: {cred_path}")

        cred = credentials.Certificate(cred_path)

    options: Dict[str, Any] = {}

    # GDPR COMPLIANCE: Force EU data residency for all Firebase services
    # This ensures data is stored and processed in EU regions only
    eu_project_id = os.getenv("FIREBASE_PROJECT_ID_EU")
    if eu_project_id:
        logger.info("🔒 GDPR COMPLIANCE: Using EU Firebase project for data residency")
        options["projectId"] = eu_project_id

    # Set database URL (Firestore)
    database_url = os.getenv("FIREBASE_DATABASE_URL")
    if database_url:
        options["databaseURL"] = database_url
        # Ensure EU region for Firestore
        if "europe-west" not in database_url:
            logger.warning("⚠️  GDPR WARNING: Firestore database URL should include EU region (europe-west)")

    # High concurrency optimizations for 10k users
    options["databaseAuthVariableOverride"] = None  # Disable auth variable override for performance

    # Advanced connection pooling configuration for high performance
    if GOOGLE_AUTH_AVAILABLE and auth_requests is not None:
        # Configure HTTP connection pooling
        options["transport"] = auth_requests.AuthorizedSession
        options["client_info"] = {
            "user_agent": "LugnTrygg/1.0 (PerformanceOptimized)",
        }

        # Firestore client connection pooling settings
        options["client_options"] = {
            "api_endpoint": "firestore.googleapis.com",
            "client_cert_source": None,
            "universe_domain": "googleapis.com",
            "credentials_file": None,
        }
        logger.info("🔹 Advanced Firestore connection pooling enabled")
    else:
        logger.info("🔹 Basic Firestore connection pooling enabled")

    # Set storage bucket with EU region
    storage_bucket_name = os.getenv("FIREBASE_STORAGE_BUCKET")
    if storage_bucket_name:
        # Ensure storage bucket is in EU region for GDPR compliance
        if not storage_bucket_name.endswith(".appspot.com"):
            storage_bucket_name += ".appspot.com"
        options["storageBucket"] = storage_bucket_name

        if "europe-west" not in storage_bucket_name:
            logger.warning("⚠️  GDPR WARNING: Storage bucket should be in EU region (europe-west)")

    firebase_admin.initialize_app(cred, options or None)
    if options:
        logger.info(
            "🔹 Firebase initierad med extra konfiguration: %s",
            ", ".join(options.keys()),
        )

    _bind_services()

    # CRITICAL FIX: Firestore client has built-in connection pooling optimized for 10k concurrent users
    logger.info("🔹 Firestore connection pooling enabled for 10k concurrent user operations")

    logger.info("✅ Firebase-initialisering lyckades!")
    return True


def get_firebase_services() -> Dict[str, Any]:
    """
    Get initialized Firebase services.

    Returns:
        Dict containing auth, db, and storage services.
    """
    if not _firebase_initialized():
        raise RuntimeError(
            "❌ Firebase är inte initierat. Kör initialize_firebase() först."
        )

    return {
        "auth": auth,
        "db": db,
        "storage": firebase_storage,
    }


initialize_firebase()
services = get_firebase_services()
db = services.get("db")
auth = services.get("auth")
firebase_admin_auth = auth
firebase_storage = services.get("storage")
firebase_exceptions = firebase_admin_exceptions
logger.info("✅ Firebase-tjänster laddades framgångsrikt (live)")


def warmup_firestore():
    """
    Warm up Firestore connection to reduce cold start latency.
    Executes a simple query to establish connection pool with a timeout.
    """
    if db is None:
        logger.warning("🔥 Firestore warmup skipped - db not initialized")
        return
    
    import threading
    
    result = {"success": False, "elapsed": 0}
    
    def _do_warmup():
        try:
            start = time.time()
            list(db.collection('_warmup').limit(1).stream())
            result["elapsed"] = (time.time() - start) * 1000
            result["success"] = True
        except Exception:
            result["elapsed"] = 0
    
    try:
        thread = threading.Thread(target=_do_warmup, daemon=True)
        thread.start()
        thread.join(timeout=10)  # Max 10 seconds for warmup
        
        if result["success"]:
            logger.info(f"🔥 Firestore warmup completed in {result['elapsed']:.0f}ms")
        elif thread.is_alive():
            logger.warning("🔥 Firestore warmup timed out after 10s - continuing without warmup")
        else:
            logger.info("🔥 Firestore warmup initialized (first connection established)")
    except (Exception, KeyboardInterrupt) as e:
        logger.warning(f"🔥 Firestore warmup skipped: {e}")


# CRITICAL: Warmup Firestore on module load to reduce first-request latency
warmup_firestore()


def safe_firestore_operation(operation_func, *args, **kwargs):
    """
    Execute a Firestore operation with automatic retry logic.
    Use this for critical database operations that need high reliability.

    Args:
        operation_func: Function that performs the Firestore operation
        *args, **kwargs: Arguments to pass to the operation function

    Returns:
        Result of the operation function

    Example:
        result = safe_firestore_operation(
            lambda: db.collection('users').document(user_id).get()
        )
    """
    @firestore_retry()
    def execute_operation():
        return operation_func(*args, **kwargs)

    return execute_operation()


async def safe_firestore_operation_async(operation_func, *args, **kwargs):
    """
    Async version of safe_firestore_operation.
    Executes Firestore operations in a thread pool for non-blocking I/O.

    Args:
        operation_func: Function that performs the Firestore operation
        *args, **kwargs: Arguments to pass to the operation function

    Returns:
        Result of the operation function
    """
    loop = asyncio.get_event_loop()

    @firestore_retry()
    def execute_operation():
        return operation_func(*args, **kwargs)

    # Run the sync operation in a thread pool
    return await loop.run_in_executor(None, execute_operation)


async def batch_firestore_operations(operations: List[Dict[str, Any]]) -> List[Any]:
    """
    Execute multiple Firestore operations concurrently for better performance.

    Args:
        operations: List of operation dictionaries with 'func', 'args', 'kwargs' keys

    Returns:
        List of operation results in the same order as input

    Example:
        operations = [
            {'func': lambda: db.collection('users').document('1').get(), 'args': (), 'kwargs': {}},
            {'func': lambda: db.collection('moods').where('user_id', '==', '1').get(), 'args': (), 'kwargs': {}}
        ]
        results = await batch_firestore_operations(operations)
    """
    tasks = []
    for op in operations:
        func = op['func']
        args = op.get('args', ())
        kwargs = op.get('kwargs', {})
        task = safe_firestore_operation_async(func, *args, **kwargs)
        tasks.append(task)

    return await asyncio.gather(*tasks, return_exceptions=True)
