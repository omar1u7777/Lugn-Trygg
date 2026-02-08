import logging
import requests
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
import os
from src.firebase_config import db

logger = logging.getLogger(__name__)

class IntegrationService:
    """Service for handling external integrations: wearable data, crisis referrals, FHIR"""

    @staticmethod
    def sync_google_fit_data(user_id: str, access_token: str) -> Dict[str, Any]:
        """Sync wearable data from Google Fit REST API"""
        try:
            # Google Fit API endpoints
            base_url = "https://www.googleapis.com/fitness/v1/users/me"

            # Get heart rate data for last 24 hours
            end_time = int(datetime.now(timezone.utc).timestamp() * 1000000000)
            start_time = end_time - (24 * 60 * 60 * 1000000000)  # 24 hours ago

            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }

            # Heart rate data source
            data_source = "derived:com.google.heart_rate.bpm:com.google.android.gms:merge_heart_rate_bpm"

            payload = {
                "aggregateBy": [{
                    "dataTypeName": "com.google.heart_rate.bpm",
                    "dataSourceId": data_source
                }],
                "bucketByTime": {"durationMillis": 3600000},  # 1 hour buckets
                "startTimeMillis": start_time // 1000000,
                "endTimeMillis": end_time // 1000000
            }

            response = requests.post(
                f"{base_url}/dataset:aggregate",
                headers=headers,
                json=payload
            )

            if response.status_code != 200:
                logger.error(f"Google Fit API error: {response.status_code} - {response.text}")
                return {"error": "Failed to sync Google Fit data"}

            data = response.json()

            # Process and store data
            wearable_data = []
            for bucket in data.get("bucket", []):
                for dataset in bucket.get("dataset", []):
                    for point in dataset.get("point", []):
                        if point.get("value"):
                            heart_rate = point["value"][0].get("fpVal", 0)
                            timestamp = point.get("startTimeNanos", 0) // 1000000000

                            wearable_data.append({
                                "timestamp": timestamp,
                                "heart_rate": heart_rate,
                                "source": "google_fit"
                            })

            # Store in Firebase
            if wearable_data:
                db.collection("wearable_data").document(user_id).set({
                    "user_id": user_id,
                    "data": wearable_data,
                    "last_sync": datetime.now(timezone.utc).isoformat(),
                    "source": "google_fit"
                }, merge=True)

            return {
                "success": True,
                "data_points": len(wearable_data),
                "message": f"Synced {len(wearable_data)} data points from Google Fit"
            }

        except Exception as e:
            logger.exception(f"Error syncing Google Fit data: {str(e)}")
            return {"error": f"Failed to sync Google Fit data: {str(e)}"}

    @staticmethod
    def sync_apple_healthkit_data(user_id: str, health_data: List[Dict]) -> Dict[str, Any]:
        """Sync wearable data from Apple HealthKit (via web integration)"""
        try:
            # Process HealthKit data (assuming JSON format from frontend)
            wearable_data = []
            for entry in health_data:
                wearable_data.append({
                    "timestamp": entry.get("timestamp"),
                    "type": entry.get("type"),  # e.g., "heart_rate", "steps"
                    "value": entry.get("value"),
                    "unit": entry.get("unit"),
                    "source": "apple_healthkit"
                })

            # Store in Firebase
            if wearable_data:
                db.collection("wearable_data").document(user_id).set({
                    "user_id": user_id,
                    "data": wearable_data,
                    "last_sync": datetime.now(timezone.utc).isoformat(),
                    "source": "apple_healthkit"
                }, merge=True)

            return {
                "success": True,
                "data_points": len(wearable_data),
                "message": f"Synced {len(wearable_data)} data points from Apple HealthKit"
            }

        except Exception as e:
            logger.exception(f"Error syncing Apple HealthKit data: {str(e)}")
            return {"error": f"Failed to sync Apple HealthKit data: {str(e)}"}

    @staticmethod
    def create_crisis_referral(user_id: str, referral_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create crisis intervention referral via BRIS API"""
        try:
            # BRIS API configuration (assuming REST API)
            bris_api_url = os.getenv("BRIS_API_URL", "https://api.bris.se/referrals")
            api_key = os.getenv("BRIS_API_KEY")

            if not api_key:
                return {"error": "BRIS API key not configured"}

            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }

            # Prepare referral payload
            payload = {
                "user_id": user_id,
                "crisis_type": referral_data.get("crisis_type"),
                "severity": referral_data.get("severity", "moderate"),
                "description": referral_data.get("description"),
                "contact_info": referral_data.get("contact_info"),
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "referrer": "lugn_trygg_app"
            }

            response = requests.post(bris_api_url, headers=headers, json=payload)

            if response.status_code not in [200, 201]:
                logger.error(f"BRIS API error: {response.status_code} - {response.text}")
                return {"error": "Failed to create crisis referral"}

            referral_result = response.json()

            # Store referral in Firebase
            db.collection("crisis_referrals").document(user_id).set({
                "user_id": user_id,
                "referral_id": referral_result.get("referral_id"),
                "status": "submitted",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "referral_data": payload
            }, merge=True)

            return {
                "success": True,
                "referral_id": referral_result.get("referral_id"),
                "message": "Crisis referral created successfully"
            }

        except Exception as e:
            logger.exception(f"Error creating crisis referral: {str(e)}")
            return {"error": f"Failed to create crisis referral: {str(e)}"}

    @staticmethod
    def get_fhir_patient(user_id: str) -> Dict[str, Any]:
        """FHIR stub: Get patient resource"""
        try:
            # Mock FHIR Patient resource
            patient_data = {
                "resourceType": "Patient",
                "id": user_id,
                "identifier": [{
                    "system": "https://lugnetrygg.se/patient",
                    "value": user_id
                }],
                "name": [{
                    "family": "Anonymized",
                    "given": ["Patient"]
                }],
                "gender": "unknown",
                "birthDate": "1900-01-01",  # Anonymized
                "address": [{
                    "country": "SE"
                }]
            }

            return {
                "success": True,
                "patient": patient_data
            }

        except Exception as e:
            logger.exception(f"Error getting FHIR patient: {str(e)}")
            return {"error": f"Failed to get FHIR patient: {str(e)}"}

    @staticmethod
    def create_fhir_observation(user_id: str, observation_data: Dict[str, Any]) -> Dict[str, Any]:
        """FHIR stub: Create observation resource"""
        try:
            # Mock FHIR Observation resource
            observation = {
                "resourceType": "Observation",
                "id": f"obs-{user_id}-{int(datetime.now(timezone.utc).timestamp())}",
                "status": "final",
                "category": [{
                    "coding": [{
                        "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                        "code": observation_data.get("category", "vital-signs"),
                        "display": observation_data.get("category_display", "Vital Signs")
                    }]
                }],
                "code": {
                    "coding": [{
                        "system": "http://loinc.org",
                        "code": observation_data.get("code", "8867-4"),
                        "display": observation_data.get("display", "Heart rate")
                    }]
                },
                "subject": {
                    "reference": f"Patient/{user_id}"
                },
                "effectiveDateTime": datetime.now(timezone.utc).isoformat(),
                "valueQuantity": {
                    "value": observation_data.get("value"),
                    "unit": observation_data.get("unit", "bpm"),
                    "system": "http://unitsofmeasure.org",
                    "code": observation_data.get("unit_code", "/min")
                }
            }

            # Store in Firebase (in real FHIR, this would be in FHIR server)
            db.collection("fhir_observations").add({
                "user_id": user_id,
                "observation": observation,
                "created_at": datetime.now(timezone.utc).isoformat()
            })

            return {
                "success": True,
                "observation": observation
            }

        except Exception as e:
            logger.exception(f"Error creating FHIR observation: {str(e)}")
            return {"error": f"Failed to create FHIR observation: {str(e)}"}

    @staticmethod
    def get_wearable_data(user_id: str) -> Dict[str, Any]:
        """Get stored wearable data for user"""
        try:
            doc = db.collection("wearable_data").document(user_id).get()
            if doc.exists:
                return {
                    "success": True,
                    "data": doc.to_dict()
                }
            else:
                return {
                    "success": True,
                    "data": None,
                    "message": "No wearable data found"
                }

        except Exception as e:
            logger.exception(f"Error getting wearable data: {str(e)}")
            return {"error": f"Failed to get wearable data: {str(e)}"}