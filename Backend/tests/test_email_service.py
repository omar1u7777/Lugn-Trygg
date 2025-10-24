"""
Tests for Email Service
Tests Resend email integration for referrals, feedback, and notifications
"""
import pytest
from unittest.mock import Mock, patch, MagicMock
from src.services.email_service import EmailService, email_service


class TestEmailServiceInit:
    """Test EmailService initialization"""
    
    @patch.dict('os.environ', {'RESEND_API_KEY': 'test_key', 'RESEND_FROM_EMAIL': 'test@example.com'})
    def test_init_with_api_key(self):
        """Test initialization with API key"""
        with patch('src.services.email_service.resend'):
            service = EmailService()
            
            assert service.api_key == 'test_key'
            assert service.from_email == 'test@example.com'
            assert service.enabled is True
            assert service.client is not None
    
    @patch.dict('os.environ', {}, clear=True)
    def test_init_without_api_key(self):
        """Test initialization without API key"""
        service = EmailService()
        
        assert service.api_key is None
        assert service.enabled is False
        assert service.client is None
    
    @patch.dict('os.environ', {'RESEND_API_KEY': 'test_key'})
    def test_init_default_from_email(self):
        """Test default from_email"""
        with patch('src.services.email_service.resend'):
            service = EmailService()
            
            assert service.from_email == 'noreply@lugn-trygg.se'
            assert service.from_name == 'Lugn & Trygg'


class TestSendReferralInvitation:
    """Test send_referral_invitation method"""
    
    @pytest.fixture
    def service(self):
        """Create EmailService with mocked client"""
        with patch.dict('os.environ', {'RESEND_API_KEY': 'test_key'}):
            with patch('src.services.email_service.resend') as mock_resend:
                service = EmailService()
                service.client = mock_resend
                return service
    
    def test_send_referral_invitation_success(self, service):
        """Test successful referral invitation"""
        mock_response = {'id': 'email_123', 'status': 'sent'}
        service.client.Emails.send = Mock(return_value=mock_response)
        
        result = service.send_referral_invitation(
            to_email='user@example.com',
            referrer_name='Anna',
            referral_code='ANNA2025',
            referral_link='https://app.lugn-trygg.se/signup?ref=ANNA2025'
        )
        
        assert result['success'] is True
        assert result['email_id'] == 'email_123'
        assert result['message'] == 'Email sent successfully'
        
        # Verify email was sent with correct data
        service.client.Emails.send.assert_called_once()
        call_args = service.client.Emails.send.call_args[0][0]
        assert call_args['to'] == ['user@example.com']
        assert 'ANNA2025' in call_args['html']
        assert 'Anna' in call_args['subject']
    
    def test_send_referral_invitation_without_client(self):
        """Test sending when client is not configured"""
        service = EmailService()
        service.client = None
        
        result = service.send_referral_invitation(
            to_email='user@example.com',
            referrer_name='Anna',
            referral_code='TEST',
            referral_link='https://example.com'
        )
        
        assert result['success'] is False
        assert 'not configured' in result['error']
    
    def test_send_referral_invitation_api_error(self, service):
        """Test handling API errors"""
        service.client.Emails.send = Mock(side_effect=Exception("API Error"))
        
        result = service.send_referral_invitation(
            to_email='user@example.com',
            referrer_name='Anna',
            referral_code='TEST',
            referral_link='https://example.com'
        )
        
        assert result['success'] is False
        assert 'API Error' in result['error']
    
    def test_send_referral_invitation_html_content(self, service):
        """Test that HTML content includes all required elements"""
        mock_response = {'id': 'test_id'}
        service.client.Emails.send = Mock(return_value=mock_response)
        
        service.send_referral_invitation(
            to_email='user@example.com',
            referrer_name='Test User',
            referral_code='CODE123',
            referral_link='https://example.com'
        )
        
        call_args = service.client.Emails.send.call_args[0][0]
        html = call_args['html']
        
        assert 'Test User' in html
        assert 'CODE123' in html
        assert 'https://example.com' in html
        assert '1 vecka gratis premium' in html
    
    def test_send_referral_invitation_plain_text(self, service):
        """Test that plain text version is included"""
        mock_response = {'id': 'test_id'}
        service.client.Emails.send = Mock(return_value=mock_response)
        
        service.send_referral_invitation(
            to_email='user@example.com',
            referrer_name='Test User',
            referral_code='CODE123',
            referral_link='https://example.com'
        )
        
        call_args = service.client.Emails.send.call_args[0][0]
        text = call_args['text']
        
        assert 'Test User' in text
        assert 'CODE123' in text
        assert 'https://example.com' in text


class TestSendReferralSuccessNotification:
    """Test send_referral_success_notification method"""
    
    @pytest.fixture
    def service(self):
        """Create EmailService with mocked client"""
        with patch.dict('os.environ', {'RESEND_API_KEY': 'test_key'}):
            with patch('src.services.email_service.resend') as mock_resend:
                service = EmailService()
                service.client = mock_resend
                return service
    
    def test_send_referral_success_notification_success(self, service):
        """Test successful referral success notification"""
        mock_response = {'id': 'notif_123'}
        service.client.Emails.send = Mock(return_value=mock_response)
        
        result = service.send_referral_success_notification(
            to_email='referrer@example.com',
            referrer_name='Anna',
            new_user_name='Erik',
            total_referrals=5,
            rewards_earned=2
        )
        
        assert result['success'] is True
        assert result['email_id'] == 'notif_123'
        
        # Verify content
        call_args = service.client.Emails.send.call_args[0][0]
        assert call_args['to'] == ['referrer@example.com']
        assert 'Erik' in call_args['html']
        assert '5' in call_args['html'] or 'fem' in call_args['html']
    
    def test_send_referral_success_notification_without_client(self):
        """Test notification when client not configured"""
        service = EmailService()
        service.client = None
        
        result = service.send_referral_success_notification(
            to_email='test@example.com',
            referrer_name='Test',
            new_user_name='User',
            total_referrals=1,
            rewards_earned=1
        )
        
        assert result['success'] is False


class TestSendFeedbackConfirmation:
    """Test send_feedback_confirmation method"""
    
    @pytest.fixture
    def service(self):
        """Create EmailService with mocked client"""
        with patch.dict('os.environ', {'RESEND_API_KEY': 'test_key'}):
            with patch('src.services.email_service.resend') as mock_resend:
                service = EmailService()
                service.client = mock_resend
                return service
    
    def test_send_feedback_confirmation_success(self, service):
        """Test successful feedback confirmation"""
        mock_response = {'id': 'feedback_123'}
        service.client.Emails.send = Mock(return_value=mock_response)
        
        # call with correct parameter names according to implementation
        result = service.send_feedback_confirmation(
            to_email='user@example.com',
            user_name='Anna',
            category='bug',
            rating=4,
            feedback_id='feedback_123456'
        )

        # send_feedback_confirmation returns boolean via _send_email
        assert result is True

        call_args = service.client.Emails.send.call_args[0][0]
        assert 'Anna' in call_args['html']
        assert 'Buggrapport' in call_args['html'] or 'buggrapport' in call_args['html'].lower()
    
    def test_send_feedback_confirmation_suggestion(self, service):
        """Test feedback confirmation for suggestion"""
        mock_response = {'id': 'test_id'}
        service.client.Emails.send = Mock(return_value=mock_response)
        
        result = service.send_feedback_confirmation(
            to_email='user@example.com',
            user_name='Erik',
            category='feature',
            rating=3,
            feedback_id='fid789'
        )

        assert result is True


class TestSendFeedbackAdminNotification:
    """Test send_feedback_admin_notification method"""
    
    @pytest.fixture
    def service(self):
        """Create EmailService with mocked client"""
        with patch.dict('os.environ', {'RESEND_API_KEY': 'test_key'}):
            with patch('src.services.email_service.resend') as mock_resend:
                service = EmailService()
                service.client = mock_resend
                return service
    
    def test_send_feedback_admin_notification_success(self, service):
        """Test admin feedback notification"""
        mock_response = {'id': 'admin_123'}
        service.client.Emails.send = Mock(return_value=mock_response)
        
        result = service.send_feedback_admin_notification(
            admin_email='admin@example.com',
            user_name='Test User',
            user_email='user@example.com',
            category='bug',
            rating=5,
            message='Critical bug',
            feedback_id='admin_fb_1'
        )

        assert result is True

        call_args = service.client.Emails.send.call_args[0][0]
        assert 'Test User' in call_args['html']
        assert 'Critical bug' in call_args['html']
        assert '5' in call_args['html']


class TestSendAnalyticsAlert:
    """Test send_analytics_alert method"""
    
    @pytest.fixture
    def service(self):
        """Create EmailService with mocked client"""
        with patch.dict('os.environ', {'RESEND_API_KEY': 'test_key'}):
            with patch('src.services.email_service.resend') as mock_resend:
                service = EmailService()
                service.client = mock_resend
                return service
    
    def test_send_analytics_alert_success(self, service):
        """Test successful analytics alert"""
        mock_response = {'id': 'alert_123'}
        service.client.Emails.send = Mock(return_value=mock_response)
        
        forecast_data = {
            'trend': 'declining',
            'risk_level': 'high',
            'next_7_days': [3.2, 3.0, 2.8, 2.5, 2.3, 2.1, 2.0]
        }
        
        result = service.send_analytics_alert(
            user_email='user@example.com',
            username='Anna',
            forecast_data=forecast_data
        )
        
        assert result is True
        
        call_args = service.client.Emails.send.call_args[0][0]
        assert call_args['to'] == ['user@example.com']
        assert 'Anna' in call_args['html']
    
    def test_send_analytics_alert_without_client(self):
        """Test analytics alert when client not configured"""
        service = EmailService()
        service.client = None
        
        result = service.send_analytics_alert(
            user_email='user@example.com',
            username='Test',
            forecast_data={}
        )
        
        assert result is False


class TestSendHealthAlert:
    """Test send_health_alert method"""
    
    @pytest.fixture
    def service(self):
        """Create EmailService with mocked client"""
        with patch.dict('os.environ', {'RESEND_API_KEY': 'test_key'}):
            with patch('src.services.email_service.resend') as mock_resend:
                service = EmailService()
                service.client = mock_resend
                return service
    
    def test_send_health_alert_success(self, service):
        """Test successful health alert"""
        mock_response = {'id': 'health_123'}
        service.client.Emails.send = Mock(return_value=mock_response)
        
        health_data = {
            'heart_rate': 95,
            'steps': 2000,
            'sleep_hours': 4.5
        }
        
        result = service.send_health_alert(
            user_email='user@example.com',
            username='Erik',
            alert_type='low_activity',
            health_data=health_data
        )
        
        assert result is True
        
        call_args = service.client.Emails.send.call_args[0][0]
        assert call_args['to'] == ['user@example.com']
        assert 'Erik' in call_args['html']
    
    def test_send_health_alert_high_heart_rate(self, service):
        """Test health alert for high heart rate"""
        mock_response = {'id': 'test_id'}
        service.client.Emails.send = Mock(return_value=mock_response)
        
        health_data = {'heart_rate': 120}
        
        result = service.send_health_alert(
            user_email='user@example.com',
            username='Test',
            alert_type='high_heart_rate',
            health_data=health_data
        )
        
        assert result is True


class TestSendEmailPrivateMethod:
    """Test _send_email private method"""
    
    @pytest.fixture
    def service(self):
        """Create EmailService with mocked client"""
        with patch.dict('os.environ', {'RESEND_API_KEY': 'test_key'}):
            with patch('src.services.email_service.resend') as mock_resend:
                service = EmailService()
                service.client = mock_resend
                return service
    
    def test_send_email_with_html_and_plain(self, service):
        """Test _send_email with both HTML and plain text"""
        mock_response = {'id': 'test_id'}
        service.client.Emails.send = Mock(return_value=mock_response)
        
        result = service._send_email(
            to_email='user@example.com',
            subject='Test Subject',
            html_content='<h1>Test HTML</h1>',
            plain_content='Test Plain'
        )
        
        assert result is True
        
        call_args = service.client.Emails.send.call_args[0][0]
        assert call_args['subject'] == 'Test Subject'
        assert call_args['html'] == '<h1>Test HTML</h1>'
        assert call_args['text'] == 'Test Plain'
    
    def test_send_email_html_only(self, service):
        """Test _send_email with only HTML"""
        mock_response = {'id': 'test_id'}
        service.client.Emails.send = Mock(return_value=mock_response)
        
        result = service._send_email(
            to_email='user@example.com',
            subject='Test',
            html_content='<p>HTML only</p>'
        )
        
        assert result is True
    
    def test_send_email_api_error(self, service):
        """Test _send_email with API error"""
        service.client.Emails.send = Mock(side_effect=Exception("Send failed"))
        
        result = service._send_email(
            to_email='user@example.com',
            subject='Test',
            html_content='<p>Test</p>'
        )
        
        assert result is False


class TestSingletonInstance:
    """Test email_service singleton"""
    
    def test_singleton_instance_exists(self):
        """Test that singleton instance is created"""
        assert email_service is not None
        assert isinstance(email_service, EmailService)


class TestEdgeCases:
    """Test edge cases and error scenarios"""
    
    @pytest.fixture
    def service(self):
        """Create EmailService with mocked client"""
        with patch.dict('os.environ', {'RESEND_API_KEY': 'test_key'}):
            with patch('src.services.email_service.resend') as mock_resend:
                service = EmailService()
                service.client = mock_resend
                return service
    
    def test_send_referral_invitation_empty_code(self, service):
        """Test referral invitation with empty code"""
        mock_response = {'id': 'test_id'}
        service.client.Emails.send = Mock(return_value=mock_response)
        
        result = service.send_referral_invitation(
            to_email='user@example.com',
            referrer_name='Test',
            referral_code='',
            referral_link='https://example.com'
        )
        
        # Should still work with empty code
        assert result['success'] is True
    
    def test_send_referral_success_notification_zero_referrals(self, service):
        """Test notification with zero referrals"""
        mock_response = {'id': 'test_id'}
        service.client.Emails.send = Mock(return_value=mock_response)
        
        result = service.send_referral_success_notification(
            to_email='user@example.com',
            referrer_name='Test',
            new_user_name='User',
            total_referrals=0,
            rewards_earned=0
        )
        
        assert result['success'] is True
    
    def test_send_analytics_alert_empty_forecast(self, service):
        """Test analytics alert with empty forecast data"""
        mock_response = {'id': 'test_id'}
        service.client.Emails.send = Mock(return_value=mock_response)
        
        result = service.send_analytics_alert(
            user_email='user@example.com',
            username='Test',
            forecast_data={}
        )
        
        assert result is True
    
    def test_send_health_alert_empty_health_data(self, service):
        """Test health alert with empty health data"""
        mock_response = {'id': 'test_id'}
        service.client.Emails.send = Mock(return_value=mock_response)
        
        result = service.send_health_alert(
            user_email='user@example.com',
            username='Test',
            alert_type='general',
            health_data={}
        )
        
        assert result is True
