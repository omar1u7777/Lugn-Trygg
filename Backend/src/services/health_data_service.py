"""
Health Data Service
Fetches real health data from integrated platforms using OAuth tokens
"""
import logging
import requests
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

# Best practice: Define timeout constant for all external API calls
# Prevents hanging connections that can exhaust server resources
REQUEST_TIMEOUT = 30  # seconds


class TokenExpiredError(Exception):
    """Raised when an OAuth access token has expired (HTTP 401)."""
    pass


def _check_token_response(response: requests.Response, provider: str) -> None:
    """Raise TokenExpiredError on 401 so callers can trigger a token refresh."""
    if response.status_code == 401:
        logger.warning(f"{provider} OAuth token expired (HTTP 401) — refresh needed")
        raise TokenExpiredError(f"{provider} access token expired. Please re-authenticate.")


class HealthDataService:
    """Service for fetching health data from various platforms"""
    
    def fetch_google_fit_data(
        self,
        access_token: str,
        start_date: datetime,
        end_date: datetime
    ) -> Dict[str, Any]:
        """
        Fetch health data from Google Fit API
        
        Args:
            access_token: Valid OAuth access token
            start_date: Start date for data
            end_date: End date for data
            
        Returns:
            Dictionary with health metrics
        """
        try:
            headers = {'Authorization': f'Bearer {access_token}'}
            base_url = 'https://www.googleapis.com/fitness/v1/users/me'
            
            # Convert to nanoseconds (Google Fit format)
            start_ns = int(start_date.timestamp() * 1e9)
            end_ns = int(end_date.timestamp() * 1e9)
            
            health_data = {}
            
            # Fetch step count
            steps_url = f"{base_url}/dataset:aggregate"
            steps_payload = {
                "aggregateBy": [{
                    "dataTypeName": "com.google.step_count.delta",
                    "dataSourceId": "derived:com.google.step_count.delta:com.google.android.gms:estimated_steps"
                }],
                "bucketByTime": {"durationMillis": 86400000},  # 1 day
                "startTimeMillis": start_ns // 1000000,
                "endTimeMillis": end_ns // 1000000
            }
            
            steps_response = requests.post(steps_url, json=steps_payload, headers=headers, timeout=REQUEST_TIMEOUT)
            _check_token_response(steps_response, "Google Fit")
            if steps_response.status_code == 200:
                steps_data = steps_response.json()
                total_steps = self._extract_google_fit_steps(steps_data)
                health_data['steps'] = total_steps
            
            # Fetch heart rate
            hr_url = f"{base_url}/dataSources/derived:com.google.heart_rate.bpm:com.google.android.gms:merge_heart_rate_bpm/datasets/{start_ns}-{end_ns}"
            hr_response = requests.get(hr_url, headers=headers, timeout=REQUEST_TIMEOUT)
            _check_token_response(hr_response, "Google Fit")
            if hr_response.status_code == 200:
                hr_data = hr_response.json()
                avg_hr = self._extract_google_fit_heart_rate(hr_data)
                health_data['heart_rate'] = avg_hr
            
            # Fetch sleep data
            sleep_url = f"{base_url}/sessions"
            sleep_params = {
                'startTime': start_date.isoformat() + 'Z',
                'endTime': end_date.isoformat() + 'Z',
                'activityType': 72  # Sleep activity type
            }
            sleep_response = requests.get(sleep_url, params=sleep_params, headers=headers, timeout=REQUEST_TIMEOUT)
            _check_token_response(sleep_response, "Google Fit")
            if sleep_response.status_code == 200:
                sleep_data = sleep_response.json()
                total_sleep = self._extract_google_fit_sleep(sleep_data)
                health_data['sleep_hours'] = total_sleep
            
            # Fetch calories
            calories_url = f"{base_url}/dataset:aggregate"
            calories_payload = {
                "aggregateBy": [{
                    "dataTypeName": "com.google.calories.expended"
                }],
                "bucketByTime": {"durationMillis": 86400000},
                "startTimeMillis": start_ns // 1000000,
                "endTimeMillis": end_ns // 1000000
            }
            calories_response = requests.post(calories_url, json=calories_payload, headers=headers, timeout=REQUEST_TIMEOUT)
            _check_token_response(calories_response, "Google Fit")
            if calories_response.status_code == 200:
                calories_data = calories_response.json()
                total_calories = self._extract_google_fit_calories(calories_data)
                health_data['calories'] = total_calories
            
            logger.info(f"Successfully fetched Google Fit data: {len(health_data)} metrics")
            return health_data
            
        except requests.Timeout:
            logger.error("Google Fit API request timed out")
            raise
        except Exception as e:
            logger.error(f"Error fetching Google Fit data: {str(e)}")
            raise
    
    def fetch_fitbit_data(
        self,
        access_token: str,
        start_date: datetime,
        end_date: datetime
    ) -> Dict[str, Any]:
        """
        Fetch health data from Fitbit API
        
        Args:
            access_token: Valid OAuth access token
            start_date: Start date for data
            end_date: End date for data
            
        Returns:
            Dictionary with health metrics
        """
        try:
            headers = {'Authorization': f'Bearer {access_token}'}
            base_url = 'https://api.fitbit.com/1/user/-'
            
            date_str = end_date.strftime('%Y-%m-%d')
            period = '7d'  # Last 7 days
            
            health_data = {}
            
            # Fetch activity summary
            activity_url = f"{base_url}/activities/date/{date_str}/{period}.json"
            activity_response = requests.get(activity_url, headers=headers, timeout=REQUEST_TIMEOUT)
            _check_token_response(activity_response, "Fitbit")
            if activity_response.status_code == 200:
                activity_data = activity_response.json()
                if 'activities-steps' in activity_data:
                    total_steps = sum(int(day['value']) for day in activity_data['activities-steps'])
                    health_data['steps'] = total_steps
            
            # Fetch heart rate
            hr_url = f"{base_url}/activities/heart/date/{date_str}/{period}.json"
            hr_response = requests.get(hr_url, headers=headers, timeout=REQUEST_TIMEOUT)
            _check_token_response(hr_response, "Fitbit")
            if hr_response.status_code == 200:
                hr_data = hr_response.json()
                if 'activities-heart' in hr_data and len(hr_data['activities-heart']) > 0:
                    hr_values = [
                        day['value']['restingHeartRate']
                        for day in hr_data['activities-heart']
                        if 'value' in day and 'restingHeartRate' in day['value']
                    ]
                    if hr_values:
                        health_data['heart_rate'] = sum(hr_values) / len(hr_values)
            
            # Fetch sleep
            sleep_url = f"{base_url}/sleep/date/{date_str}/{period}.json"
            sleep_response = requests.get(sleep_url, headers=headers, timeout=REQUEST_TIMEOUT)
            _check_token_response(sleep_response, "Fitbit")
            if sleep_response.status_code == 200:
                sleep_data = sleep_response.json()
                if 'sleep' in sleep_data:
                    total_minutes = sum(sleep['minutesAsleep'] for sleep in sleep_data['sleep'])
                    health_data['sleep_hours'] = round(total_minutes / 60, 1)
            
            # Fetch calories
            calories_url = f"{base_url}/activities/calories/date/{date_str}/{period}.json"
            calories_response = requests.get(calories_url, headers=headers, timeout=REQUEST_TIMEOUT)
            _check_token_response(calories_response, "Fitbit")
            if calories_response.status_code == 200:
                calories_data = calories_response.json()
                if 'activities-calories' in calories_data:
                    total_calories = sum(int(day['value']) for day in calories_data['activities-calories'])
                    health_data['calories'] = total_calories
            
            logger.info(f"Successfully fetched Fitbit data: {len(health_data)} metrics")
            return health_data
            
        except requests.Timeout:
            logger.error("Fitbit API request timed out")
            raise
        except Exception as e:
            logger.error(f"Error fetching Fitbit data: {str(e)}")
            raise
    
    def fetch_samsung_health_data(
        self,
        access_token: str,
        start_date: datetime,
        end_date: datetime
    ) -> Dict[str, Any]:
        """
        Fetch health data from Samsung Health API
        
        Args:
            access_token: Valid OAuth access token
            start_date: Start date for data
            end_date: End date for data
            
        Returns:
            Dictionary with health metrics
        """
        try:
            headers = {'Authorization': f'Bearer {access_token}'}
            base_url = 'https://us.shealth.samsung.com/data'
            
            start_ms = int(start_date.timestamp() * 1000)
            end_ms = int(end_date.timestamp() * 1000)
            
            health_data = {}
            
            # Fetch step count
            steps_url = f"{base_url}/com.samsung.health.step_count"
            steps_params = {
                'start_time': start_ms,
                'end_time': end_ms
            }
            steps_response = requests.get(steps_url, params=steps_params, headers=headers, timeout=REQUEST_TIMEOUT)
            _check_token_response(steps_response, "Samsung Health")
            if steps_response.status_code == 200:
                steps_data = steps_response.json()
                total_steps = sum(item.get('count', 0) for item in steps_data.get('data', []))
                health_data['steps'] = total_steps
            
            # Fetch heart rate
            hr_url = f"{base_url}/com.samsung.health.heart_rate"
            hr_params = {
                'start_time': start_ms,
                'end_time': end_ms
            }
            hr_response = requests.get(hr_url, params=hr_params, headers=headers, timeout=REQUEST_TIMEOUT)
            _check_token_response(hr_response, "Samsung Health")
            if hr_response.status_code == 200:
                hr_data = hr_response.json()
                hr_values = [item.get('heart_rate', 0) for item in hr_data.get('data', [])]
                if hr_values:
                    health_data['heart_rate'] = sum(hr_values) / len(hr_values)
            
            # Fetch sleep
            sleep_url = f"{base_url}/com.samsung.health.sleep"
            sleep_params = {
                'start_time': start_ms,
                'end_time': end_ms
            }
            sleep_response = requests.get(sleep_url, params=sleep_params, headers=headers, timeout=REQUEST_TIMEOUT)
            _check_token_response(sleep_response, "Samsung Health")
            if sleep_response.status_code == 200:
                sleep_data = sleep_response.json()
                total_duration_ms = sum(item.get('duration', 0) for item in sleep_data.get('data', []))
                health_data['sleep_hours'] = round(total_duration_ms / 3600000, 1)  # Convert ms to hours
            
            logger.info(f"Successfully fetched Samsung Health data: {len(health_data)} metrics")
            return health_data
            
        except requests.Timeout:
            logger.error("Samsung Health API request timed out")
            raise
        except Exception as e:
            logger.error(f"Error fetching Samsung Health data: {str(e)}")
            raise
    
    # Helper methods for data extraction
    
    def _extract_google_fit_steps(self, data: Dict) -> int:
        """Extract total steps from Google Fit response"""
        total = 0
        for bucket in data.get('bucket', []):
            for dataset in bucket.get('dataset', []):
                for point in dataset.get('point', []):
                    for value in point.get('value', []):
                        total += value.get('intVal', 0)
        return total
    
    def _extract_google_fit_heart_rate(self, data: Dict) -> float:
        """Extract average heart rate from Google Fit response"""
        hr_values = []
        for point in data.get('point', []):
            for value in point.get('value', []):
                hr_values.append(value.get('fpVal', 0))
        return round(sum(hr_values) / len(hr_values), 1) if hr_values else 0
    
    def _extract_google_fit_sleep(self, data: Dict) -> float:
        """Extract total sleep hours from Google Fit response"""
        total_ms = 0
        for session in data.get('session', []):
            start_ms = int(session.get('startTimeMillis', 0))
            end_ms = int(session.get('endTimeMillis', 0))
            total_ms += (end_ms - start_ms)
        return round(total_ms / 3600000, 1)  # Convert ms to hours
    
    def _extract_google_fit_calories(self, data: Dict) -> int:
        """Extract total calories from Google Fit response"""
        total = 0
        for bucket in data.get('bucket', []):
            for dataset in bucket.get('dataset', []):
                for point in dataset.get('point', []):
                    for value in point.get('value', []):
                        total += value.get('fpVal', 0)
        return int(total)

# Singleton instance
health_data_service = HealthDataService()
