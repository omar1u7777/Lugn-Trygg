"""
Tests for Health Data Service
Tests fetching health data from Google Fit, Fitbit, and Samsung Health
"""
import pytest
from unittest.mock import Mock, patch
from datetime import datetime, timedelta
from src.services.health_data_service import HealthDataService, health_data_service


class TestHealthDataServiceInit:
    """Test HealthDataService initialization"""
    
    def test_init_creates_instance(self):
        """Test that instance is created"""
        service = HealthDataService()
        assert service is not None
        assert isinstance(service, HealthDataService)


class TestFetchGoogleFitData:
    """Test fetch_google_fit_data method"""
    
    @pytest.fixture
    def service(self):
        """Create HealthDataService instance"""
        return HealthDataService()
    
    @pytest.fixture
    def date_range(self):
        """Create test date range"""
        end = datetime.now()
        start = end - timedelta(days=7)
        return start, end
    
    @patch('src.services.health_data_service.requests.post')
    @patch('src.services.health_data_service.requests.get')
    def test_fetch_google_fit_data_success(self, mock_get, mock_post, service, date_range):
        """Test successful Google Fit data fetch"""
        start_date, end_date = date_range
        
        # Mock steps response
        steps_response = Mock()
        steps_response.status_code = 200
        steps_response.json.return_value = {
            'bucket': [{
                'dataset': [{
                    'point': [{
                        'value': [{'intVal': 5000}]
                    }, {
                        'value': [{'intVal': 7000}]
                    }]
                }]
            }]
        }
        
        # Mock heart rate response
        hr_response = Mock()
        hr_response.status_code = 200
        hr_response.json.return_value = {
            'point': [{
                'value': [{'fpVal': 72.5}]
            }, {
                'value': [{'fpVal': 68.3}]
            }]
        }
        
        # Mock sleep response
        sleep_response = Mock()
        sleep_response.status_code = 200
        sleep_response.json.return_value = {
            'session': [{
                'startTimeMillis': '1000000',
                'endTimeMillis': '1028800000'  # 8 hours in ms
            }]
        }
        
        # Mock calories response
        calories_response = Mock()
        calories_response.status_code = 200
        calories_response.json.return_value = {
            'bucket': [{
                'dataset': [{
                    'point': [{
                        'value': [{'fpVal': 2500}]
                    }]
                }]
            }]
        }
        
        # Setup mock responses
        mock_post.side_effect = [steps_response, calories_response]
        mock_get.side_effect = [hr_response, sleep_response]
        
        result = service.fetch_google_fit_data('test_token', start_date, end_date)
        
        assert 'steps' in result
        assert 'heart_rate' in result
        assert 'sleep_hours' in result
        assert 'calories' in result
        assert result['steps'] == 12000
        assert isinstance(result['heart_rate'], float)
        assert isinstance(result['sleep_hours'], float)
        assert isinstance(result['calories'], int)
    
    @patch('src.services.health_data_service.requests.get')
    @patch('src.services.health_data_service.requests.post')
    def test_fetch_google_fit_data_steps_only(self, mock_post, mock_get, service, date_range):
        """Test fetching only steps data"""
        start_date, end_date = date_range
        
        steps_response = Mock()
        steps_response.status_code = 200
        steps_response.json.return_value = {
            'bucket': [{
                'dataset': [{
                    'point': [{
                        'value': [{'intVal': 10000}]
                    }]
                }]
            }]
        }
        
        mock_post.return_value = steps_response
        # GET endpoints (heart_rate, sleep) return non-200 to skip those metrics
        get_response = Mock()
        get_response.status_code = 500
        mock_get.return_value = get_response
        
        result = service.fetch_google_fit_data('test_token', start_date, end_date)
        
        assert 'steps' in result
        assert result['steps'] == 10000
    
    @patch('src.services.health_data_service.requests.post')
    def test_fetch_google_fit_data_api_error(self, mock_post, service, date_range):
        """Test error handling for API failures"""
        start_date, end_date = date_range
        
        mock_post.side_effect = Exception("API Error")
        
        with pytest.raises(Exception, match="API Error"):
            service.fetch_google_fit_data('invalid_token', start_date, end_date)
    
    @patch('src.services.health_data_service.requests.post')
    @patch('src.services.health_data_service.requests.get')
    def test_fetch_google_fit_data_partial_failure(self, mock_get, mock_post, service, date_range):
        """Test handling partial API failures"""
        start_date, end_date = date_range
        
        # Steps succeed
        steps_response = Mock()
        steps_response.status_code = 200
        steps_response.json.return_value = {
            'bucket': [{
                'dataset': [{
                    'point': [{
                        'value': [{'intVal': 8000}]
                    }]
                }]
            }]
        }
        
        # Heart rate / sleep fail with non-401 status (401 raises TokenExpiredError)
        hr_response = Mock()
        hr_response.status_code = 500
        
        mock_post.return_value = steps_response
        mock_get.return_value = hr_response
        
        result = service.fetch_google_fit_data('test_token', start_date, end_date)
        
        # Should have steps but not heart rate
        assert 'steps' in result
        assert result['steps'] == 8000


class TestFetchFitbitData:
    """Test fetch_fitbit_data method"""
    
    @pytest.fixture
    def service(self):
        """Create HealthDataService instance"""
        return HealthDataService()
    
    @pytest.fixture
    def date_range(self):
        """Create test date range"""
        end = datetime.now()
        start = end - timedelta(days=7)
        return start, end
    
    @patch('src.services.health_data_service.requests.get')
    def test_fetch_fitbit_data_success(self, mock_get, service, date_range):
        """Test successful Fitbit data fetch"""
        start_date, end_date = date_range
        
        # Mock activity response
        activity_response = Mock()
        activity_response.status_code = 200
        activity_response.json.return_value = {
            'activities-steps': [
                {'value': '5000'},
                {'value': '7500'},
                {'value': '10000'}
            ]
        }
        
        # Mock heart rate response
        hr_response = Mock()
        hr_response.status_code = 200
        hr_response.json.return_value = {
            'activities-heart': [
                {'value': {'restingHeartRate': 65}},
                {'value': {'restingHeartRate': 70}}
            ]
        }
        
        # Mock sleep response
        sleep_response = Mock()
        sleep_response.status_code = 200
        sleep_response.json.return_value = {
            'sleep': [
                {'minutesAsleep': 420},
                {'minutesAsleep': 480}
            ]
        }
        
        # Mock calories response
        calories_response = Mock()
        calories_response.status_code = 200
        calories_response.json.return_value = {
            'activities-calories': [
                {'value': '2000'},
                {'value': '2200'}
            ]
        }
        
        mock_get.side_effect = [activity_response, hr_response, sleep_response, calories_response]
        
        result = service.fetch_fitbit_data('test_token', start_date, end_date)
        
        assert 'steps' in result
        assert 'heart_rate' in result
        assert 'sleep_hours' in result
        assert 'calories' in result
        assert result['steps'] == 22500
        assert result['heart_rate'] == 67.5
        assert result['sleep_hours'] == 15.0
        assert result['calories'] == 4200
    
    @patch('src.services.health_data_service.requests.get')
    def test_fetch_fitbit_data_empty_heart_rate(self, mock_get, service, date_range):
        """Test Fitbit data with missing heart rate data"""
        start_date, end_date = date_range
        
        activity_response = Mock()
        activity_response.status_code = 200
        activity_response.json.return_value = {
            'activities-steps': [{'value': '8000'}]
        }
        
        hr_response = Mock()
        hr_response.status_code = 200
        hr_response.json.return_value = {
            'activities-heart': []
        }
        
        mock_get.side_effect = [activity_response, hr_response, Mock(status_code=404), Mock(status_code=404)]
        
        result = service.fetch_fitbit_data('test_token', start_date, end_date)
        
        assert 'steps' in result
        assert 'heart_rate' not in result
    
    @patch('src.services.health_data_service.requests.get')
    def test_fetch_fitbit_data_api_error(self, mock_get, service, date_range):
        """Test error handling for Fitbit API failures"""
        start_date, end_date = date_range
        
        mock_get.side_effect = Exception("Fitbit API Error")
        
        with pytest.raises(Exception, match="Fitbit API Error"):
            service.fetch_fitbit_data('invalid_token', start_date, end_date)
    
    @patch('src.services.health_data_service.requests.get')
    def test_fetch_fitbit_data_heart_rate_without_resting(self, mock_get, service, date_range):
        """Test Fitbit heart rate data without restingHeartRate field"""
        start_date, end_date = date_range
        
        activity_response = Mock()
        activity_response.status_code = 200
        activity_response.json.return_value = {
            'activities-steps': [{'value': '5000'}]
        }
        
        hr_response = Mock()
        hr_response.status_code = 200
        hr_response.json.return_value = {
            'activities-heart': [
                {'value': {}},  # No restingHeartRate
                {'date': '2024-01-01'}  # No value field
            ]
        }
        
        mock_get.side_effect = [activity_response, hr_response, Mock(status_code=404), Mock(status_code=404)]
        
        result = service.fetch_fitbit_data('test_token', start_date, end_date)
        
        assert 'steps' in result
        assert 'heart_rate' not in result


class TestFetchSamsungHealthData:
    """Test fetch_samsung_health_data method"""
    
    @pytest.fixture
    def service(self):
        """Create HealthDataService instance"""
        return HealthDataService()
    
    @pytest.fixture
    def date_range(self):
        """Create test date range"""
        end = datetime.now()
        start = end - timedelta(days=7)
        return start, end
    
    @patch('src.services.health_data_service.requests.get')
    def test_fetch_samsung_health_data_success(self, mock_get, service, date_range):
        """Test successful Samsung Health data fetch"""
        start_date, end_date = date_range
        
        # Mock steps response
        steps_response = Mock()
        steps_response.status_code = 200
        steps_response.json.return_value = {
            'data': [
                {'count': 6000},
                {'count': 8000},
                {'count': 7500}
            ]
        }
        
        # Mock heart rate response
        hr_response = Mock()
        hr_response.status_code = 200
        hr_response.json.return_value = {
            'data': [
                {'heart_rate': 72},
                {'heart_rate': 68},
                {'heart_rate': 75}
            ]
        }
        
        # Mock sleep response
        sleep_response = Mock()
        sleep_response.status_code = 200
        sleep_response.json.return_value = {
            'data': [
                {'duration': 28800000},  # 8 hours in ms (8 * 60 * 60 * 1000)
                {'duration': 25200000}   # 7 hours in ms (7 * 60 * 60 * 1000)
            ]
        }
        
        mock_get.side_effect = [steps_response, hr_response, sleep_response]
        
        result = service.fetch_samsung_health_data('test_token', start_date, end_date)
        
        assert 'steps' in result
        assert 'heart_rate' in result
        assert 'sleep_hours' in result
        assert result['steps'] == 21500
        assert result['heart_rate'] == pytest.approx(71.67, 0.1)
        # Total: 54000000 ms / 3600000 = 15 hours
        assert result['sleep_hours'] == 15.0
    
    @patch('src.services.health_data_service.requests.get')
    def test_fetch_samsung_health_data_empty_response(self, mock_get, service, date_range):
        """Test Samsung Health with empty data"""
        start_date, end_date = date_range
        
        empty_response = Mock()
        empty_response.status_code = 200
        empty_response.json.return_value = {'data': []}
        
        mock_get.return_value = empty_response
        
        result = service.fetch_samsung_health_data('test_token', start_date, end_date)
        
        assert 'steps' in result
        assert result['steps'] == 0
    
    @patch('src.services.health_data_service.requests.get')
    def test_fetch_samsung_health_data_api_error(self, mock_get, service, date_range):
        """Test error handling for Samsung Health API failures"""
        start_date, end_date = date_range
        
        mock_get.side_effect = Exception("Samsung API Error")
        
        with pytest.raises(Exception, match="Samsung API Error"):
            service.fetch_samsung_health_data('invalid_token', start_date, end_date)
    
    @patch('src.services.health_data_service.requests.get')
    def test_fetch_samsung_health_data_missing_fields(self, mock_get, service, date_range):
        """Test Samsung Health data with missing fields"""
        start_date, end_date = date_range
        
        steps_response = Mock()
        steps_response.status_code = 200
        steps_response.json.return_value = {
            'data': [
                {'count': 5000},
                {},  # Missing count
                {'count': 3000}
            ]
        }
        
        hr_response = Mock()
        hr_response.status_code = 200
        hr_response.json.return_value = {
            'data': [
                {},  # Missing heart_rate
                {'heart_rate': 70}
            ]
        }
        
        sleep_response = Mock()
        sleep_response.status_code = 404
        
        mock_get.side_effect = [steps_response, hr_response, sleep_response]
        
        result = service.fetch_samsung_health_data('test_token', start_date, end_date)
        
        assert result['steps'] == 8000
        # Average: (0 + 70) / 2 = 35.0
        assert result['heart_rate'] == 35.0


class TestExtractGoogleFitSteps:
    """Test _extract_google_fit_steps helper method"""
    
    @pytest.fixture
    def service(self):
        """Create HealthDataService instance"""
        return HealthDataService()
    
    def test_extract_google_fit_steps_success(self, service):
        """Test extracting steps from Google Fit response"""
        data = {
            'bucket': [{
                'dataset': [{
                    'point': [
                        {'value': [{'intVal': 1000}]},
                        {'value': [{'intVal': 2000}]}
                    ]
                }]
            }, {
                'dataset': [{
                    'point': [
                        {'value': [{'intVal': 3000}]}
                    ]
                }]
            }]
        }
        
        result = service._extract_google_fit_steps(data)
        assert result == 6000
    
    def test_extract_google_fit_steps_empty(self, service):
        """Test extracting steps from empty response"""
        data = {'bucket': []}
        
        result = service._extract_google_fit_steps(data)
        assert result == 0
    
    def test_extract_google_fit_steps_missing_fields(self, service):
        """Test extracting steps with missing fields"""
        data = {
            'bucket': [{
                'dataset': [{
                    'point': [
                        {'value': [{}]},  # Missing intVal
                        {'value': [{'intVal': 5000}]}
                    ]
                }]
            }]
        }
        
        result = service._extract_google_fit_steps(data)
        assert result == 5000


class TestExtractGoogleFitHeartRate:
    """Test _extract_google_fit_heart_rate helper method"""
    
    @pytest.fixture
    def service(self):
        """Create HealthDataService instance"""
        return HealthDataService()
    
    def test_extract_google_fit_heart_rate_success(self, service):
        """Test extracting heart rate from Google Fit response"""
        data = {
            'point': [
                {'value': [{'fpVal': 72.5}]},
                {'value': [{'fpVal': 68.3}]},
                {'value': [{'fpVal': 75.2}]}
            ]
        }
        
        result = service._extract_google_fit_heart_rate(data)
        assert result == pytest.approx(72.0, 0.1)
    
    def test_extract_google_fit_heart_rate_empty(self, service):
        """Test extracting heart rate from empty response"""
        data = {'point': []}
        
        result = service._extract_google_fit_heart_rate(data)
        assert result == 0
    
    def test_extract_google_fit_heart_rate_missing_fpval(self, service):
        """Test extracting heart rate with missing fpVal"""
        data = {
            'point': [
                {'value': [{}]},  # Missing fpVal
                {'value': [{'fpVal': 70.0}]}
            ]
        }
        
        result = service._extract_google_fit_heart_rate(data)
        assert result == 35.0  # (0 + 70) / 2


class TestExtractGoogleFitSleep:
    """Test _extract_google_fit_sleep helper method"""
    
    @pytest.fixture
    def service(self):
        """Create HealthDataService instance"""
        return HealthDataService()
    
    def test_extract_google_fit_sleep_success(self, service):
        """Test extracting sleep from Google Fit response"""
        data = {
            'session': [
                {
                    'startTimeMillis': '0',
                    'endTimeMillis': '28800000'  # 8 hours in ms
                },
                {
                    'startTimeMillis': '0',
                    'endTimeMillis': '25200000'  # 7 hours in ms
                }
            ]
        }
        
        result = service._extract_google_fit_sleep(data)
        assert result == pytest.approx(15.0, 0.1)
    
    def test_extract_google_fit_sleep_empty(self, service):
        """Test extracting sleep from empty response"""
        data = {'session': []}
        
        result = service._extract_google_fit_sleep(data)
        assert result == 0.0
    
    def test_extract_google_fit_sleep_missing_fields(self, service):
        """Test extracting sleep with missing fields"""
        data = {
            'session': [
                {
                    'startTimeMillis': '0',
                    'endTimeMillis': '14400000'  # 4 hours in ms
                },
                {}  # Missing fields
            ]
        }
        
        result = service._extract_google_fit_sleep(data)
        assert result == pytest.approx(4.0, 0.1)


class TestExtractGoogleFitCalories:
    """Test _extract_google_fit_calories helper method"""
    
    @pytest.fixture
    def service(self):
        """Create HealthDataService instance"""
        return HealthDataService()
    
    def test_extract_google_fit_calories_success(self, service):
        """Test extracting calories from Google Fit response"""
        data = {
            'bucket': [{
                'dataset': [{
                    'point': [
                        {'value': [{'fpVal': 500.5}]},
                        {'value': [{'fpVal': 1200.3}]}
                    ]
                }]
            }, {
                'dataset': [{
                    'point': [
                        {'value': [{'fpVal': 800.2}]}
                    ]
                }]
            }]
        }
        
        result = service._extract_google_fit_calories(data)
        assert result == 2501
    
    def test_extract_google_fit_calories_empty(self, service):
        """Test extracting calories from empty response"""
        data = {'bucket': []}
        
        result = service._extract_google_fit_calories(data)
        assert result == 0
    
    def test_extract_google_fit_calories_missing_fields(self, service):
        """Test extracting calories with missing fields"""
        data = {
            'bucket': [{
                'dataset': [{
                    'point': [
                        {'value': [{}]},  # Missing fpVal
                        {'value': [{'fpVal': 2000.0}]}
                    ]
                }]
            }]
        }
        
        result = service._extract_google_fit_calories(data)
        assert result == 2000


class TestSingletonInstance:
    """Test health_data_service singleton"""
    
    def test_singleton_instance_exists(self):
        """Test that singleton instance is created"""
        assert health_data_service is not None
        assert isinstance(health_data_service, HealthDataService)


class TestEdgeCases:
    """Test edge cases and error scenarios"""
    
    @pytest.fixture
    def service(self):
        """Create HealthDataService instance"""
        return HealthDataService()
    
    @pytest.fixture
    def date_range(self):
        """Create test date range"""
        end = datetime.now()
        start = end - timedelta(days=7)
        return start, end
    
    @patch('src.services.health_data_service.requests.get')
    @patch('src.services.health_data_service.requests.post')
    def test_fetch_google_fit_data_with_zero_duration(self, mock_post, mock_get, service):
        """Test Google Fit with zero duration date range"""
        same_date = datetime.now()
        
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {'bucket': []}
        mock_post.return_value = mock_response
        # GET endpoints (heart_rate, sleep) return empty 200
        get_response = Mock()
        get_response.status_code = 200
        get_response.json.return_value = {'point': [], 'session': []}
        mock_get.return_value = get_response
        
        result = service.fetch_google_fit_data('test_token', same_date, same_date)
        
        assert isinstance(result, dict)
    
    @patch('src.services.health_data_service.requests.get')
    def test_fetch_fitbit_data_with_zero_values(self, mock_get, service, date_range):
        """Test Fitbit with all zero values"""
        start_date, end_date = date_range
        
        response = Mock()
        response.status_code = 200
        response.json.return_value = {
            'activities-steps': [
                {'value': '0'},
                {'value': '0'}
            ]
        }
        
        mock_get.return_value = response
        
        result = service.fetch_fitbit_data('test_token', start_date, end_date)
        
        assert result['steps'] == 0
    
    def test_extract_google_fit_heart_rate_single_value(self, service):
        """Test heart rate extraction with single value"""
        data = {
            'point': [
                {'value': [{'fpVal': 72.0}]}
            ]
        }
        
        result = service._extract_google_fit_heart_rate(data)
        assert result == 72.0
