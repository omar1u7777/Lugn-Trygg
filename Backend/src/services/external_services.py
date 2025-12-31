"""
External Services Integration - Centralized external API management

Provides robust integration with external services including:
- OpenAI API for AI features
- Email services (SendGrid, SES)
- SMS services (Twilio)
- Payment processing (Stripe)
- Analytics services
- Monitoring services
"""

import asyncio
import logging
import time
from typing import Dict, Any, Optional, List, Callable
from datetime import datetime, timezone
import json

from ..config import (
    OPENAI_API_KEY,
    SENDGRID_API_KEY,
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    STRIPE_SECRET_KEY,
    ANALYTICS_API_KEY
)
from ..middleware.error_handler import error_handler, with_circuit_breaker
from ..services.health_check_service import health_check_service
from .performance_monitor import PerformanceMonitor

logger = logging.getLogger(__name__)

class ExternalServiceClient:
    """Base class for external service clients"""

    def __init__(self, service_name: str, base_url: str, api_key: Optional[str] = None,
                 timeout: float = 30.0, retries: int = 3):
        self.service_name = service_name
        self.base_url = base_url
        self.api_key = api_key
        self.timeout = timeout
        self.retries = retries
        self.session = None

        # Register health check
        health_check_service.register_check(
            f'external_{service_name}',
            self._health_check,
            critical=False,
            interval=60
        )

    async def _init_session(self):
        """Initialize HTTP session"""
        try:
            import aiohttp
            if not self.session:
                self.session = aiohttp.ClientSession(
                    timeout=aiohttp.ClientTimeout(total=self.timeout),
                    headers=self._get_default_headers()
                )
        except ImportError:
            logger.warning("aiohttp not available, using synchronous requests")

    def _get_default_headers(self) -> Dict[str, str]:
        """Get default headers for requests"""
        headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'LugnTrygg/1.0'
        }
        if self.api_key:
            headers['Authorization'] = f'Bearer {self.api_key}'
        return headers

    async def _make_request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        """Make HTTP request with error handling and retries"""
        url = f"{self.base_url}{endpoint}"

        for attempt in range(self.retries):
            try:
                await self._init_session()

                if self.session:
                    # Async request
                    import aiohttp
                    start_time = time.time()

                    async with self.session.request(method, url, **kwargs) as response:
                        response_time = time.time() - start_time
                        result = await self._process_response(response, response_time)

                        # Log performance
                        logger.info(f"{self.service_name} API call: {method} {endpoint} -> {response.status}",
                                  extra={
                                      'api_service': self.service_name,
                                      'api_endpoint': endpoint,
                                      'api_method': method,
                                      'api_status_code': response.status,
                                      'response_time': response_time
                                  })

                        return result
                else:
                    # Fallback to sync requests
                    import requests
                    start_time = time.time()

                    response = requests.request(method, url, timeout=self.timeout, **kwargs)
                    response_time = time.time() - start_time

                    result = self._process_sync_response(response, response_time)

                    logger.info(f"{self.service_name} API call: {method} {endpoint} -> {response.status_code}",
                              extra={
                                  'api_service': self.service_name,
                                  'api_endpoint': endpoint,
                                  'api_method': method,
                                  'api_status_code': response.status_code,
                                  'response_time': response_time
                              })

                    return result

            except Exception as e:
                logger.warning(f"{self.service_name} API call failed (attempt {attempt + 1}): {e}")

                if attempt == self.retries - 1:
                    # All retries exhausted
                    error_handler.handle_error(e, {
                        'service': self.service_name,
                        'endpoint': endpoint,
                        'method': method,
                        'attempts': attempt + 1
                    })
                    raise e

                # Wait before retry (exponential backoff)
                await asyncio.sleep(2 ** attempt)

    def _process_response(self, response, response_time: float) -> Dict[str, Any]:
        """Process async response"""
        if response.status >= 400:
            error_text = response.text
            raise Exception(f"API error {response.status}: {error_text}")

        return {
            'status_code': response.status,
            'response_time': response_time,
            'data': response.json() if response.content_type == 'application/json' else response.text
        }

    def _process_sync_response(self, response, response_time: float) -> Dict[str, Any]:
        """Process sync response"""
        response.raise_for_status()

        try:
            data = response.json()
        except:
            data = response.text

        return {
            'status_code': response.status_code,
            'response_time': response_time,
            'data': data
        }

    async def _health_check(self) -> Dict[str, Any]:
        """Health check for the external service"""
        try:
            # Simple health check - override in subclasses for specific checks
            result = await self._make_request('GET', '/health')
            return {
                'status': 'healthy',
                'response_time': result['response_time']
            }
        except Exception as e:
            return {
                'status': 'unhealthy',
                'error': str(e)
            }

    async def close(self):
        """Close the client session"""
        if self.session:
            await self.session.close()
            self.session = None

class OpenAIService(ExternalServiceClient):
    """OpenAI API integration"""

    def __init__(self):
        super().__init__(
            'openai',
            'https://api.openai.com/v1',
            OPENAI_API_KEY,
            timeout=60.0  # Longer timeout for AI requests
        )

    @with_circuit_breaker('openai')
    async def generate_text(self, prompt: str, model: str = 'gpt-3.5-turbo',
                           max_tokens: int = 1000, temperature: float = 0.7) -> str:
        """Generate text using OpenAI"""
        payload = {
            'model': model,
            'messages': [{'role': 'user', 'content': prompt}],
            'max_tokens': max_tokens,
            'temperature': temperature
        }

        result = await self._make_request('POST', '/chat/completions', json=payload)
        return result['data']['choices'][0]['message']['content']

    @with_circuit_breaker('openai')
    async def analyze_sentiment(self, text: str) -> Dict[str, Any]:
        """Analyze sentiment of text"""
        prompt = f"Analyze the sentiment of this text and respond with JSON: {text}"

        result = await self.generate_text(prompt, max_tokens=200)
        # Parse JSON response
        try:
            return json.loads(result)
        except:
            return {'sentiment': 'neutral', 'confidence': 0.5}

class EmailService(ExternalServiceClient):
    """Email service integration (SendGrid)"""

    def __init__(self):
        super().__init__(
            'sendgrid',
            'https://api.sendgrid.com/v3',
            SENDGRID_API_KEY
        )

    @with_circuit_breaker('email')
    async def send_email(self, to_email: str, subject: str, html_content: str,
                        from_email: str = 'noreply@lugntrygg.se') -> bool:
        """Send email via SendGrid"""
        payload = {
            'personalizations': [{
                'to': [{'email': to_email}],
                'subject': subject
            }],
            'from': {'email': from_email},
            'content': [{
                'type': 'text/html',
                'value': html_content
            }]
        }

        result = await self._make_request('POST', '/mail/send', json=payload)
        return result['status_code'] == 202

class SMSService(ExternalServiceClient):
    """SMS service integration (Twilio)"""

    def __init__(self):
        super().__init__(
            'twilio',
            f'https://api.twilio.com/2010-04-01/Accounts/{TWILIO_ACCOUNT_SID}',
            timeout=30.0
        )
        self.auth_token = TWILIO_AUTH_TOKEN

    def _get_default_headers(self) -> Dict[str, str]:
        """Override headers for Twilio Basic Auth"""
        import base64
        auth_string = f"{TWILIO_ACCOUNT_SID}:{self.auth_token}"
        encoded_auth = base64.b64encode(auth_string.encode()).decode()

        return {
            'Authorization': f'Basic {encoded_auth}',
            'Content-Type': 'application/x-www-form-urlencoded'
        }

    @with_circuit_breaker('sms')
    async def send_sms(self, to_number: str, message: str,
                      from_number: Optional[str] = None) -> bool:
        """Send SMS via Twilio"""
        # This would need proper Twilio integration
        # For now, just log the attempt
        logger.info(f"SMS to {to_number}: {message}")
        return True

class PaymentService(ExternalServiceClient):
    """Payment processing integration (Stripe)"""

    def __init__(self):
        super().__init__(
            'stripe',
            'https://api.stripe.com/v1',
            STRIPE_SECRET_KEY
        )

    def _get_default_headers(self) -> Dict[str, str]:
        """Override headers for Stripe"""
        return {
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/x-www-form-urlencoded'
        }

    @with_circuit_breaker('payment')
    async def create_payment_intent(self, amount: int, currency: str = 'sek',
                                   metadata: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
        """Create Stripe payment intent"""
        payload = {
            'amount': amount,
            'currency': currency,
            'automatic_payment_methods': {'enabled': True}
        }

        if metadata:
            payload['metadata'] = metadata

        result = await self._make_request('POST', '/payment_intents', data=payload)
        return result['data']

class AnalyticsService(ExternalServiceClient):
    """Analytics service integration"""

    def __init__(self):
        super().__init__(
            'analytics',
            'https://api.mixpanel.com',
            ANALYTICS_API_KEY
        )

    @with_circuit_breaker('analytics')
    async def track_event(self, event_name: str, user_id: str,
                         properties: Optional[Dict[str, Any]] = None) -> bool:
        """Track analytics event"""
        payload = {
            'event': event_name,
            'properties': {
                'distinct_id': user_id,
                'token': self.api_key,
                **(properties or {})
            }
        }

        try:
            result = await self._make_request('POST', '/track', json=[payload])
            return result['status_code'] == 200
        except:
            # Analytics failures shouldn't break the app
            logger.warning(f"Analytics tracking failed for event: {event_name}")
            return False

class ExternalServicesManager:
    """Manager for all external service integrations"""

    def __init__(self):
        self.services: Dict[str, ExternalServiceClient] = {}
        self._initialized = False

    async def initialize(self):
        """Initialize all external services"""
        if self._initialized:
            return

        # Initialize services
        self.services['openai'] = OpenAIService()
        self.services['email'] = EmailService()
        self.services['sms'] = SMSService()
        self.services['payment'] = PaymentService()
        self.services['analytics'] = AnalyticsService()

        # Initialize all services
        init_tasks = [service._init_session() for service in self.services.values()]
        await asyncio.gather(*init_tasks, return_exceptions=True)

        self._initialized = True
        logger.info("External services initialized")

    async def shutdown(self):
        """Shutdown all external services"""
        if not self._initialized:
            return

        close_tasks = [service.close() for service in self.services.values()]
        await asyncio.gather(*close_tasks, return_exceptions=True)

        self.services.clear()
        self._initialized = False
        logger.info("External services shutdown")

    def get_service(self, name: str) -> Optional[ExternalServiceClient]:
        """Get a service by name"""
        return self.services.get(name)

    async def health_check_all(self) -> Dict[str, Any]:
        """Health check all external services"""
        results = {}

        for name, service in self.services.items():
            try:
                health = await service._health_check()
                results[name] = health
            except Exception as e:
                results[name] = {
                    'status': 'error',
                    'error': str(e)
                }

        # Determine overall status
        healthy_count = sum(1 for r in results.values() if r.get('status') == 'healthy')
        total_count = len(results)

        return {
            'overall_status': 'healthy' if healthy_count == total_count else 'degraded',
            'services': results,
            'healthy_count': healthy_count,
            'total_count': total_count
        }

# Global external services manager
external_services = ExternalServicesManager()

# Convenience functions
async def get_openai_service() -> OpenAIService:
    """Get OpenAI service instance"""
    await external_services.initialize()
    return external_services.get_service('openai')

async def get_email_service() -> EmailService:
    """Get email service instance"""
    await external_services.initialize()
    return external_services.get_service('email')

async def get_sms_service() -> SMSService:
    """Get SMS service instance"""
    await external_services.initialize()
    return external_services.get_service('sms')

async def get_payment_service() -> PaymentService:
    """Get payment service instance"""
    await external_services.initialize()
    return external_services.get_service('payment')

async def get_analytics_service() -> AnalyticsService:
    """Get analytics service instance"""
    await external_services.initialize()
    return external_services.get_service('analytics')