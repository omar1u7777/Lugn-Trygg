"""OpenAI / Azure OpenAI / Google NLP client management.

Owns detection and construction of the LLM client. The client instance and
availability flags are stored on the facade (svc) so tests that mock
`ai_services.client` or `_openai_available` keep working unchanged.
"""

import json
import logging
import os

from src.utils.telemetry import telemetry

logger = logging.getLogger(__name__)

_IS_PRODUCTION = os.getenv('FLASK_ENV', 'development').lower() == 'production'


def get_google_nlp_credentials():
    """Build explicit credentials for google-cloud-language from the same
    service account JSON already used for Firebase (FIREBASE_CREDENTIALS),
    since Application Default Credentials aren't configured on Render.

    Returns None if no usable credential source is found, in which case the
    caller falls back to ADC (which will raise its own clear error).
    """
    raw = os.getenv("FIREBASE_CREDENTIALS", "").strip()
    if not raw.startswith("{"):
        return None
    try:
        from google.oauth2 import service_account
        return service_account.Credentials.from_service_account_info(json.loads(raw))
    except Exception as exc:
        logger.warning(f"Could not derive Google NLP credentials from FIREBASE_CREDENTIALS: {exc}")
        return None


class AIClientProvider:
    """Single responsibility: provide a configured LLM client (or report absence)."""

    def __init__(self, svc):
        self._svc = svc

    def get_openai_client(self):
        """Lazy load OpenAI client"""
        svc = self._svc
        if svc.client is None:
            if not svc._openai_checked:
                svc._openai_available = svc._check_openai()
                svc._openai_checked = True
            if svc._openai_available:
                # Client is already initialized in check_openai
                pass
        return svc.client

    def check_google_nlp(self) -> bool:
        """Check if Google Cloud Natural Language API is available.

        Package importability alone isn't enough -- LanguageServiceClient()
        resolves credentials at construction time, so without a usable
        credential source every call fails with "default credentials were
        not found", one failed API round-trip per request.
        """
        try:
            from google.cloud import language_v1  # noqa: F401
        except ImportError:
            logger.warning("Google Cloud Natural Language API not available")
            return False

        if get_google_nlp_credentials() is None and not os.getenv("GOOGLE_APPLICATION_CREDENTIALS"):
            if _IS_PRODUCTION:
                telemetry.degraded(
                    "google_nlp",
                    "unconfigured_in_production",
                    consequence="Sentiment analysis falls through to OpenAI/ML fallback",
                )
            logger.warning(
                "No Google Cloud credentials configured (FIREBASE_CREDENTIALS / "
                "GOOGLE_APPLICATION_CREDENTIALS) — Google NLP sentiment analysis disabled"
            )
            return False

        return True

    def get_model_name(self) -> str:
        """Get the model/deployment name for API calls.

        For Azure OpenAI: returns the deployment name (e.g., 'gpt-4o-mini')
        For standard OpenAI: returns the model name (e.g., 'gpt-4o-mini')
        """
        svc = self._svc
        if hasattr(svc, '_azure_deployment') and svc._azure_deployment:
            return svc._azure_deployment
        return "gpt-4o"

    def check_openai(self) -> bool:
        """Check if OpenAI or Azure OpenAI API is available"""
        svc = self._svc
        # Check for Azure OpenAI first
        azure_key = os.getenv("AZURE_OPENAI_API_KEY")
        azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
        azure_api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-12-01-preview")
        azure_deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4o")

        if azure_key and azure_endpoint:
            try:
                import httpx
                from openai import AzureOpenAI
                timeout = httpx.Timeout(10.0, connect=5.0, read=30.0, write=10.0, pool=5.0)
                svc.client = AzureOpenAI(
                    api_key=azure_key,
                    azure_endpoint=azure_endpoint,
                    api_version=azure_api_version,
                    timeout=timeout,
                    max_retries=2
                )
                # Store deployment name for later use
                svc._azure_deployment = azure_deployment
                logger.info("✅ Azure OpenAI client initialized successfully")
                return True
            except ImportError:
                logger.warning("OpenAI library not available")
                return False
            except Exception as e:
                logger.error(f"Failed to initialize Azure OpenAI client: {str(e)}")
                return False

        # Fallback to standard OpenAI
        api_key = os.getenv("OPENAI_API_KEY")
        if api_key:
            try:
                # CRITICAL FIX: Add timeout to prevent hanging requests (4.1s timeout issue)
                # Timeout: 10s connect, 30s read for total max 30s response time
                import httpx
                from openai import OpenAI
                timeout = httpx.Timeout(10.0, connect=5.0, read=30.0, write=10.0, pool=5.0)
                svc.client = OpenAI(
                    api_key=api_key,
                    timeout=timeout,  # 30s max for API calls to prevent 4.1s hangs
                    max_retries=2  # Retry up to 2 times on failure
                )
                svc._azure_deployment = None
                logger.info("✅ OpenAI client initialized successfully with 30s timeout")
                return True
            except ImportError:
                logger.warning("OpenAI library not available")
                return False
            except Exception as e:
                logger.error(f"Failed to initialize OpenAI client: {str(e)}")
                return False
        else:
            if _IS_PRODUCTION:
                telemetry.degraded(
                    "ai_client",
                    "unconfigured_in_production",
                    consequence="AI Stories, Forecast and Chat run on local heuristics",
                )
                logger.warning(
                    "[B4] OPENAI_API_KEY or AZURE_OPENAI_API_KEY not set — AI Stories, Forecast and Chat are running in degraded mode."
                )
            else:
                logger.warning("OPENAI_API_KEY or AZURE_OPENAI_API_KEY not set — AI features will use fallback logic")
            return False
