"""
Comprehensive tests for admin_routes.py
Target: Increase coverage from 47% to 100%

Tests all endpoints:
- GET /performance-metrics
- OPTIONS /performance-metrics
"""

import pytest
import json
from unittest.mock import Mock, patch, MagicMock


def test_get_performance_metrics_success(client, mocker):
    """Test retrieving performance metrics with full data"""
    mock_metrics = {
        "endpoints": {
            "/api/mood/log": {
                "count": 150,
                "avg_time": 0.234,
                "max_time": 1.2,
                "min_time": 0.05
            },
            "/api/chatbot/message": {
                "count": 300,
                "avg_time": 0.456,
                "max_time": 2.1,
                "min_time": 0.1
            }
        },
        "total_requests": 450,
        "error_counts": {
            "500": 5,
            "404": 12,
            "401": 3
        },
        "slow_requests_count": 8
    }
    
    # Mock performance_monitor.get_metrics()
    mock_monitor = mocker.patch('src.routes.admin_routes.performance_monitor')
    mock_monitor.get_metrics = Mock(return_value=mock_metrics)

    # Ensure hasattr returns True for get_metrics check
    mocker.patch('src.routes.admin_routes.hasattr', return_value=True)
    
    response = client.get('/api/admin/performance-metrics')
    
    assert response.status_code == 200
    data = response.get_json()
    assert data == mock_metrics
    assert data['total_requests'] == 450
    assert data['slow_requests_count'] == 8
    assert len(data['endpoints']) == 2


def test_get_performance_metrics_empty(client, mocker):
    """Test retrieving empty performance metrics"""
    mock_metrics = {
        "endpoints": {},
        "total_requests": 0,
        "error_counts": {},
        "slow_requests_count": 0
    }
    
    mock_monitor = mocker.patch('src.routes.admin_routes.performance_monitor')
    mock_monitor.get_metrics.return_value = mock_metrics
    
    response = client.get('/api/admin/performance-metrics')
    
    assert response.status_code == 200
    data = response.get_json()
    assert data['total_requests'] == 0
    assert data['endpoints'] == {}


def test_get_performance_metrics_no_get_metrics_method(client, mocker):
    """Test when performance_monitor doesn't have get_metrics method"""
    # Mock performance_monitor without get_metrics
    mock_monitor = mocker.patch('src.routes.admin_routes.performance_monitor')
    # Remove get_metrics attribute
    delattr(mock_monitor, 'get_metrics')
    
    # Mock hasattr to return False
    mocker.patch('src.routes.admin_routes.hasattr', return_value=False)
    
    response = client.get('/api/admin/performance-metrics')
    
    assert response.status_code == 200
    data = response.get_json()
    # Should return default metrics
    assert data['total_requests'] == 0
    assert data['slow_requests_count'] == 0
    assert 'endpoints' in data
    assert 'error_counts' in data


def test_get_performance_metrics_with_many_endpoints(client, mocker):
    """Test metrics with many endpoints"""
    mock_metrics = {
        "endpoints": {f"/api/endpoint{i}": {"count": i * 10} for i in range(1, 21)},
        "total_requests": 2100,
        "error_counts": {"500": 10},
        "slow_requests_count": 50
    }
    
    mock_monitor = mocker.patch('src.routes.admin_routes.performance_monitor')
    mock_monitor.get_metrics.return_value = mock_metrics
    
    response = client.get('/api/admin/performance-metrics')
    
    assert response.status_code == 200
    data = response.get_json()
    assert len(data['endpoints']) == 20


def test_get_performance_metrics_exception(client, mocker):
    """Test error handling when get_metrics raises exception"""
    mock_monitor = mocker.patch('src.routes.admin_routes.performance_monitor')
    mock_monitor.get_metrics.side_effect = Exception('Database connection failed')
    
    response = client.get('/api/admin/performance-metrics')
    
    assert response.status_code == 500
    data = response.get_json()
    assert 'error' in data
    assert data['error'] == 'Failed to get performance metrics'


def test_get_performance_metrics_runtime_error(client, mocker):
    """Test handling of RuntimeError"""
    mock_monitor = mocker.patch('src.routes.admin_routes.performance_monitor')
    mock_monitor.get_metrics.side_effect = RuntimeError('Performance monitor not initialized')
    
    response = client.get('/api/admin/performance-metrics')
    
    assert response.status_code == 500
    data = response.get_json()
    assert data['error'] == 'Failed to get performance metrics'


def test_get_performance_metrics_value_error(client, mocker):
    """Test handling of ValueError"""
    mock_monitor = mocker.patch('src.routes.admin_routes.performance_monitor')
    mock_monitor.get_metrics.side_effect = ValueError('Invalid metrics data')
    
    response = client.get('/api/admin/performance-metrics')
    
    assert response.status_code == 500


def test_performance_metrics_options_request(client):
    """Test OPTIONS request for CORS preflight"""
    response = client.options('/api/admin/performance-metrics')
    
    assert response.status_code == 204
    assert response.data == b''


def test_performance_metrics_options_no_data(client):
    """Test OPTIONS returns no content"""
    response = client.options('/api/admin/performance-metrics')
    
    assert response.status_code == 204
    assert len(response.data) == 0


def test_get_performance_metrics_with_logger_call(client, mocker):
    """Test that logger.exception is called on error"""
    mock_monitor = mocker.patch('src.routes.admin_routes.performance_monitor')
    mock_monitor.get_metrics.side_effect = Exception('Test error')
    
    mock_logger = mocker.patch('src.routes.admin_routes.logger')
    
    response = client.get('/api/admin/performance-metrics')
    
    assert response.status_code == 500
    # Verify logger.exception was called
    mock_logger.exception.assert_called_once()
    call_args = str(mock_logger.exception.call_args)
    assert 'Failed to get performance metrics' in call_args


def test_get_performance_metrics_with_nested_data(client, mocker):
    """Test metrics with complex nested structure"""
    mock_metrics = {
        "endpoints": {
            "/api/mood/log": {
                "count": 100,
                "avg_time": 0.5,
                "methods": {
                    "POST": 80,
                    "GET": 20
                },
                "status_codes": {
                    "200": 95,
                    "500": 5
                }
            }
        },
        "total_requests": 100,
        "error_counts": {},
        "slow_requests_count": 0
    }
    
    mock_monitor = mocker.patch('src.routes.admin_routes.performance_monitor')
    mock_monitor.get_metrics.return_value = mock_metrics
    
    response = client.get('/api/admin/performance-metrics')
    
    assert response.status_code == 200
    data = response.get_json()
    assert 'methods' in data['endpoints']['/api/mood/log']


def test_get_performance_metrics_with_float_values(client, mocker):
    """Test metrics with precise float timing values"""
    mock_metrics = {
        "endpoints": {
            "/api/test": {
                "avg_time": 0.123456789,
                "max_time": 1.987654321,
                "min_time": 0.001234567
            }
        },
        "total_requests": 1000,
        "error_counts": {},
        "slow_requests_count": 15
    }
    
    mock_monitor = mocker.patch('src.routes.admin_routes.performance_monitor')
    mock_monitor.get_metrics.return_value = mock_metrics
    
    response = client.get('/api/admin/performance-metrics')
    
    assert response.status_code == 200
    data = response.get_json()
    assert isinstance(data['endpoints']['/api/test']['avg_time'], float)


def test_get_performance_metrics_multiple_calls(client, mocker):
    """Test multiple sequential calls to metrics endpoint"""
    mock_monitor = mocker.patch('src.routes.admin_routes.performance_monitor')
    
    # Different metrics for each call
    metrics_sequence = [
        {"total_requests": 100, "endpoints": {}, "error_counts": {}, "slow_requests_count": 0},
        {"total_requests": 200, "endpoints": {}, "error_counts": {}, "slow_requests_count": 5},
        {"total_requests": 300, "endpoints": {}, "error_counts": {}, "slow_requests_count": 10}
    ]
    
    for expected_metrics in metrics_sequence:
        mock_monitor.get_metrics.return_value = expected_metrics
        response = client.get('/api/admin/performance-metrics')
        
        assert response.status_code == 200
        data = response.get_json()
        assert data['total_requests'] == expected_metrics['total_requests']


def test_performance_metrics_json_serializable(client, mocker):
    """Test that all metrics data is JSON serializable"""
    mock_metrics = {
        "endpoints": {"/api/test": {"count": 10}},
        "total_requests": 10,
        "error_counts": {"404": 1},
        "slow_requests_count": 0
    }
    
    mock_monitor = mocker.patch('src.routes.admin_routes.performance_monitor')
    mock_monitor.get_metrics.return_value = mock_metrics
    
    response = client.get('/api/admin/performance-metrics')
    
    assert response.status_code == 200
    # Should be valid JSON
    data = response.get_json()
    json_str = json.dumps(data)
    assert json_str is not None
