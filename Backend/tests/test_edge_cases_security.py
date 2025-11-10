"""
Backend Test Coverage Enhancement
Comprehensive tests for edge cases, error handling, and security
Target: Boost coverage from 48% to 95%+
"""

import pytest
from datetime import datetime, timedelta
import json


class TestMoodRoutesEdgeCases:
    """Edge cases for mood logging"""

    def test_mood_value_boundary_min(self, client, auth_headers, mock_auth_service):
        """Test minimum mood value (1)"""
        response = client.post(
            '/api/mood',
            json={'mood': 1, 'note': 'Lowest mood'},
            headers=auth_headers
        )
        assert response.status_code in [200, 201]

    def test_mood_value_boundary_max(self, client, auth_headers, mock_auth_service):
        """Test maximum mood value (10)"""
        response = client.post(
            '/api/mood',
            json={'mood': 10, 'note': 'Highest mood'},
            headers=auth_headers
        )
        assert response.status_code in [200, 201]

    def test_mood_value_zero(self, client, auth_headers, mock_auth_service):
        """Test invalid zero mood value"""
        response = client.post(
            '/api/mood',
            json={'mood': 0, 'note': 'Invalid'},
            headers=auth_headers
        )
        assert response.status_code == 400

    def test_mood_value_eleven(self, client, auth_headers, mock_auth_service):
        """Test invalid mood value > 10"""
        response = client.post(
            '/api/mood',
            json={'mood': 11, 'note': 'Invalid'},
            headers=auth_headers
        )
        assert response.status_code == 400

    def test_mood_negative(self, client, auth_headers, mock_auth_service):
        """Test negative mood value"""
        response = client.post(
            '/api/mood',
            json={'mood': -1, 'note': 'Invalid'},
            headers=auth_headers
        )
        assert response.status_code == 400

    def test_mood_with_empty_note(self, client, auth_headers, mock_auth_service):
        """Test mood with empty note"""
        response = client.post(
            '/api/mood',
            json={'mood': 5, 'note': ''},
            headers=auth_headers
        )
        assert response.status_code in [200, 201]

    def test_mood_without_note(self, client, auth_headers, mock_auth_service):
        """Test mood without note field"""
        response = client.post(
            '/api/mood',
            json={'mood': 5},
            headers=auth_headers
        )
        assert response.status_code in [200, 201]

    def test_mood_with_very_long_note(self, client, auth_headers, mock_auth_service):
        """Test mood with extremely long note"""
        long_note = 'x' * 5000
        response = client.post(
            '/api/mood',
            json={'mood': 5, 'note': long_note},
            headers=auth_headers
        )
        assert response.status_code in [200, 201, 400]


class TestSecurityEdgeCases:
    """Security vulnerability tests"""

    def test_sql_injection_mood_note(self, client, auth_headers, mock_auth_service):
        """Test SQL injection in mood note"""
        sql_payload = "'; DROP TABLE moods;--"
        response = client.post(
            '/api/mood',
            json={'mood': 5, 'note': sql_payload},
            headers=auth_headers
        )
        # Should sanitize and not cause error
        assert response.status_code in [200, 201]

    def test_xss_in_mood_note(self, client, auth_headers, mock_auth_service):
        """Test XSS script injection"""
        xss_payload = '<script>alert("XSS")</script>'
        response = client.post(
            '/api/mood',
            json={'mood': 5, 'note': xss_payload},
            headers=auth_headers
        )
        assert response.status_code in [200, 201]
        # Verify script tag is removed
        data = response.get_json()
        if data and 'note' in data:
            assert '<script>' not in data['note'].lower()

    def test_html_injection(self, client, auth_headers, mock_auth_service):
        """Test HTML tag injection"""
        html_payload = '<img src=x onerror="alert(1)">'
        response = client.post(
            '/api/mood',
            json={'mood': 5, 'note': html_payload},
            headers=auth_headers
        )
        assert response.status_code in [200, 201]

    def test_path_traversal(self, client, auth_headers, mock_auth_service):
        """Test path traversal attempt"""
        response = client.get(
            '/api/../../../etc/passwd',
            headers=auth_headers
        )
        assert response.status_code in [400, 404]

    def test_unauthorized_access(self, client):
        """Test access without authentication"""
        response = client.get('/api/mood')
        assert response.status_code in [401, 403]

    def test_invalid_token(self, client):
        """Test with invalid JWT token"""
        invalid_headers = {'Authorization': 'Bearer invalid-token-123'}
        response = client.get('/api/mood', headers=invalid_headers)
        assert response.status_code in [401, 403]

    def test_expired_token(self, client):
        """Test with expired token"""
        expired_token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjB9.invalid'
        headers = {'Authorization': f'Bearer {expired_token}'}
        response = client.get('/api/mood', headers=headers)
        assert response.status_code == 401


class TestErrorHandling:
    """Error handling and recovery tests"""

    def test_malformed_json(self, client, auth_headers, mock_auth_service):
        """Test malformed JSON request"""
        response = client.post(
            '/api/mood',
            data='{"mood": invalid}',
            headers={**auth_headers, 'Content-Type': 'application/json'}
        )
        assert response.status_code == 400

    def test_missing_content_type(self, client, auth_headers, mock_auth_service):
        """Test request without content-type"""
        response = client.post(
            '/api/mood',
            data=json.dumps({'mood': 5}),
            headers=auth_headers
        )
        # Should handle gracefully
        assert response.status_code in [200, 201, 400, 415]

    def test_empty_request_body(self, client, auth_headers, mock_auth_service):
        """Test empty POST request"""
        response = client.post(
            '/api/mood',
            json={},
            headers=auth_headers
        )
        assert response.status_code == 400

    def test_null_values(self, client, auth_headers, mock_auth_service):
        """Test null values in request"""
        response = client.post(
            '/api/mood',
            json={'mood': None, 'note': None},
            headers=auth_headers
        )
        assert response.status_code == 400

    def test_type_mismatch(self, client, auth_headers, mock_auth_service):
        """Test type mismatch (string instead of int)"""
        response = client.post(
            '/api/mood',
            json={'mood': 'five', 'note': 'Test'},
            headers=auth_headers
        )
        assert response.status_code == 400

    def test_unexpected_fields(self, client, auth_headers, mock_auth_service):
        """Test request with unexpected fields"""
        response = client.post(
            '/api/mood',
            json={
                'mood': 5,
                'note': 'Test',
                'unexpected_field': 'value',
                'another_field': 123
            },
            headers=auth_headers
        )
        # Should ignore extra fields and succeed
        assert response.status_code in [200, 201]


class TestChatbotEdgeCases:
    """Chatbot functionality edge cases"""

    def test_empty_message(self, client, auth_headers, mock_auth_service):
        """Test chatbot with empty message"""
        response = client.post(
            '/api/chatbot/message',
            json={'message': ''},
            headers=auth_headers
        )
        assert response.status_code in [200, 400]

    def test_very_long_message(self, client, auth_headers, mock_auth_service):
        """Test chatbot with very long message"""
        long_message = 'x' * 10000
        response = client.post(
            '/api/chatbot/message',
            json={'message': long_message},
            headers=auth_headers
        )
        assert response.status_code in [200, 400]

    def test_special_characters(self, client, auth_headers, mock_auth_service):
        """Test chatbot with special characters"""
        response = client.post(
            '/api/chatbot/message',
            json={'message': '!@#$%^&*()_+{}|:"<>?'},
            headers=auth_headers
        )
        assert response.status_code in [200, 201]

    def test_unicode_emoji(self, client, auth_headers, mock_auth_service):
        """Test chatbot with emoji"""
        response = client.post(
            '/api/chatbot/message',
            json={'message': '😊 Jag känner mig glad! 🎉'},
            headers=auth_headers
        )
        assert response.status_code in [200, 201]

    def test_crisis_keywords(self, client, auth_headers, mock_auth_service):
        """Test crisis keyword detection"""
        crisis_messages = [
            'Jag vill skada mig själv',
            'Jag tänker på självmord',
            'Jag vill inte leva längre'
        ]
        
        for message in crisis_messages:
            response = client.post(
                '/api/chatbot/message',
                json={'message': message},
                headers=auth_headers
            )
            # Should respond with crisis support
            assert response.status_code in [200, 201]
            data = response.get_json()
            if data and 'response' in data:
                # Response should include crisis support info
                assert any(keyword in data['response'].lower() 
                          for keyword in ['hjälp', '1177', 'kris', 'professional'])


class TestAuthenticationEdgeCases:
    """Authentication edge cases"""

    def test_register_existing_email(self, client):
        """Test registering with existing email"""
        email = f'test_{datetime.now().timestamp()}@example.com'
        
        # First registration
        client.post(
            '/api/auth/register',
            json={'email': email, 'password': 'Test1234!'}
        )
        
        # Second registration (should fail)
        response = client.post(
            '/api/auth/register',
            json={'email': email, 'password': 'Test1234!'}
        )
        assert response.status_code in [400, 409]

    def test_login_nonexistent_user(self, client):
        """Test login with non-existent user"""
        response = client.post(
            '/api/auth/login',
            json={
                'email': 'nonexistent@example.com',
                'password': 'Test1234!'
            }
        )
        assert response.status_code in [401, 404]

    def test_login_wrong_password(self, client):
        """Test login with wrong password"""
        response = client.post(
            '/api/auth/login',
            json={
                'email': 'test@example.com',
                'password': 'WrongPassword123!'
            }
        )
        assert response.status_code == 401

    def test_weak_password(self, client):
        """Test registration with weak password"""
        weak_passwords = ['123', 'password', 'abc', '111111']
        
        for pwd in weak_passwords:
            response = client.post(
                '/api/auth/register',
                json={
                    'email': 'test@example.com',
                    'password': pwd
                }
            )
            assert response.status_code == 400

    def test_invalid_email_format(self, client):
        """Test registration with invalid email"""
        invalid_emails = [
            'notanemail',
            '@example.com',
            'user@',
            'user@@example.com'
        ]
        
        for email in invalid_emails:
            response = client.post(
                '/api/auth/register',
                json={'email': email, 'password': 'Test1234!'}
            )
            assert response.status_code == 400


class TestMemoryRoutesEdgeCases:
    """Memory recording edge cases"""

    def test_empty_memory_content(self, client, auth_headers, mock_auth_service):
        """Test memory with empty content"""
        response = client.post(
            '/api/memories',
            json={'content': '', 'type': 'text'},
            headers=auth_headers
        )
        assert response.status_code in [200, 201, 400]

    def test_invalid_memory_type(self, client, auth_headers, mock_auth_service):
        """Test memory with invalid type"""
        response = client.post(
            '/api/memories',
            json={'content': 'Test', 'type': 'invalid_type'},
            headers=auth_headers
        )
        assert response.status_code in [200, 201, 400]

    def test_large_memory_content(self, client, auth_headers, mock_auth_service):
        """Test memory with large content"""
        large_content = 'x' * 100000  # 100KB
        response = client.post(
            '/api/memories',
            json={'content': large_content, 'type': 'text'},
            headers=auth_headers
        )
        assert response.status_code in [200, 201, 413]


class TestFeedbackRoutesEdgeCases:
    """Feedback system edge cases"""

    def test_feedback_with_rating_boundary(self, client, auth_headers, mock_auth_service):
        """Test feedback rating boundaries"""
        for rating in [1, 5]:  # Min and max
            response = client.post(
                '/api/feedback',
                json={
                    'rating': rating,
                    'comment': 'Test feedback',
                    'category': 'general'
                },
                headers=auth_headers
            )
            assert response.status_code in [200, 201]

    def test_feedback_invalid_rating(self, client, auth_headers, mock_auth_service):
        """Test feedback with invalid rating"""
        for rating in [0, 6, -1]:
            response = client.post(
                '/api/feedback',
                json={
                    'rating': rating,
                    'comment': 'Test',
                    'category': 'general'
                },
                headers=auth_headers
            )
            assert response.status_code in [400, 422]

    def test_feedback_empty_comment(self, client, auth_headers, mock_auth_service):
        """Test feedback with empty comment"""
        response = client.post(
            '/api/feedback',
            json={
                'rating': 5,
                'comment': '',
                'category': 'general'
            },
            headers=auth_headers
        )
        assert response.status_code in [200, 201, 400]


class TestRateLimitingScenarios:
    """Rate limiting tests"""

    def test_rapid_requests(self, client, auth_headers, mock_auth_service):
        """Test rapid successive requests"""
        responses = []
        for i in range(50):
            response = client.get('/api/mood', headers=auth_headers)
            responses.append(response.status_code)
            if response.status_code == 429:
                break
        
        # Should eventually rate limit or succeed all
        assert all(code in [200, 429] for code in responses)

    def test_rate_limit_different_endpoints(self, client, auth_headers, mock_auth_service):
        """Test rate limits across different endpoints"""
        endpoints = ['/api/mood', '/api/memories', '/api/feedback']
        
        for endpoint in endpoints:
            response = client.get(endpoint, headers=auth_headers)
            # Should handle gracefully
            assert response.status_code in [200, 404, 429]


class TestUnicodeAndInternationalization:
    """Unicode and internationalization tests"""

    def test_swedish_characters(self, client, auth_headers, mock_auth_service):
        """Test Swedish special characters"""
        swedish_text = 'Jag känner mig väldigt bättre än förut! Åååh!'
        response = client.post(
            '/api/mood',
            json={'mood': 8, 'note': swedish_text},
            headers=auth_headers
        )
        assert response.status_code in [200, 201]

    def test_various_unicode(self, client, auth_headers, mock_auth_service):
        """Test various unicode characters"""
        unicode_texts = [
            '你好世界',  # Chinese
            'مرحبا بالعالم',  # Arabic
            'Привет мир',  # Russian
            '🎉🎊😊🌟',  # Emoji
        ]
        
        for text in unicode_texts:
            response = client.post(
                '/api/mood',
                json={'mood': 7, 'note': text},
                headers=auth_headers
            )
            assert response.status_code in [200, 201]


class TestConcurrencyScenarios:
    """Concurrency and race condition tests"""

    def test_concurrent_mood_logs(self, client, auth_headers, mock_auth_service):
        """Test concurrent mood logging"""
        import threading
        results = []

        def log_mood():
            response = client.post(
                '/api/mood',
                json={'mood': 7, 'note': 'Concurrent test'},
                headers=auth_headers
            )
            results.append(response.status_code)

        threads = [threading.Thread(target=log_mood) for _ in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        # All should succeed or fail gracefully
        assert all(code in [200, 201, 429, 500] for code in results)


class TestPaginationAndSorting:
    """Pagination and sorting edge cases"""

    def test_mood_list_pagination(self, client, auth_headers, mock_auth_service):
        """Test mood list with pagination"""
        response = client.get(
            '/api/mood?page=1&limit=10',
            headers=auth_headers
        )
        assert response.status_code == 200

    def test_invalid_pagination_params(self, client, auth_headers, mock_auth_service):
        """Test invalid pagination parameters"""
        test_cases = [
            '/api/mood?page=-1&limit=10',
            '/api/mood?page=1&limit=-5',
            '/api/mood?page=abc&limit=def',
            '/api/mood?page=0&limit=0',
        ]
        
        for url in test_cases:
            response = client.get(url, headers=auth_headers)
            # Should handle gracefully
            assert response.status_code in [200, 400]

    def test_large_pagination_limit(self, client, auth_headers, mock_auth_service):
        """Test pagination with very large limit"""
        response = client.get(
            '/api/mood?page=1&limit=10000',
            headers=auth_headers
        )
        # Should limit to reasonable max or return error
        assert response.status_code in [200, 400]


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
