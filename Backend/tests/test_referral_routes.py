"""
Comprehensive tests for referral routes - targeting 90%+ coverage
Tests: referral generation, invitations, completion, rewards, leaderboard
"""
import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime, timezone
import json


class TestReferralGeneration:
    """Tests for /generate endpoint"""
    
    @patch('src.routes.referral_routes.db')
    def test_generate_new_referral(self, mock_db, client):
        """Test generating referral code for new user"""
        mock_collection = Mock()
        mock_document = Mock()
        mock_get = Mock()
        mock_get.exists = False
        
        mock_db.collection.return_value = mock_collection
        mock_collection.document.return_value = mock_document
        mock_document.get.return_value = mock_get
        
        response = client.post('/api/referral/generate',
            json={"user_id": "test123"},
            content_type='application/json'
        )
        
        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] == True
        assert "referralCode" in data["data"]
        assert "userId" in data["data"]
        assert data["data"]["totalReferrals"] == 0
        assert data["data"]["successfulReferrals"] == 0
        assert mock_document.set.called
    
    @patch('src.routes.referral_routes.db')
    def test_generate_existing_referral(self, mock_db, client):
        """Test getting existing referral code"""
        existing_data = {
            "user_id": "test123",
            "referral_code": "TEST1234",
            "total_referrals": 5,
            "successful_referrals": 3,
            "rewards_earned": 4
        }
        
        mock_collection = Mock()
        mock_document = Mock()
        mock_get = Mock()
        mock_get.exists = True
        mock_get.to_dict.return_value = existing_data
        
        mock_db.collection.return_value = mock_collection
        mock_collection.document.return_value = mock_document
        mock_document.get.return_value = mock_get
        
        response = client.post('/api/referral/generate',
            json={"user_id": "test123"},
            content_type='application/json'
        )
        
        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] == True
        assert data["data"]["referralCode"] == "TEST1234"
        assert data["data"]["totalReferrals"] == 5
        assert not mock_document.set.called
    
    def test_generate_missing_user_id(self, client):
        """Test generate without user_id"""
        response = client.post('/api/referral/generate',
            json={},
            content_type='application/json'
        )
        
        assert response.status_code == 400
        data = response.get_json()
        assert "error" in data
    
    def test_generate_empty_user_id(self, client):
        """Test generate with empty user_id"""
        response = client.post('/api/referral/generate',
            json={"user_id": "  "},
            content_type='application/json'
        )
        
        assert response.status_code == 400
        data = response.get_json()
        assert "error" in data
    
    @patch('src.routes.referral_routes.db')
    def test_generate_database_error(self, mock_db, client):
        """Test generate when database fails"""
        mock_db.collection.side_effect = Exception("Database error")
        
        response = client.post('/api/referral/generate',
            json={"user_id": "test123"},
            content_type='application/json'
        )
        
        assert response.status_code == 500
        data = response.get_json()
        assert "error" in data
    
    def test_generate_options_request(self, client):
        """Test OPTIONS request for CORS"""
        response = client.options('/api/referral/generate')
        assert response.status_code == 204


class TestReferralStats:
    """Tests for /stats endpoint"""
    
    @patch('src.routes.referral_routes.db')
    def test_get_stats_existing_user(self, mock_db, client):
        """Test getting stats for existing user"""
        existing_data = {
            "user_id": "test123",
            "referral_code": "TEST1234",
            "total_referrals": 10,
            "successful_referrals": 7,
            "rewards_earned": 10
        }
        
        mock_collection = Mock()
        mock_document = Mock()
        mock_get = Mock()
        mock_get.exists = True
        mock_get.to_dict.return_value = existing_data
        
        mock_db.collection.return_value = mock_collection
        mock_collection.document.return_value = mock_document
        mock_document.get.return_value = mock_get
        
        response = client.get('/api/referral/stats?user_id=test123')
        
        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] == True
        assert data["data"]["totalReferrals"] == 10
        assert data["data"]["successfulReferrals"] == 7
    
    @patch('src.routes.referral_routes.db')
    def test_get_stats_new_user(self, mock_db, client):
        """Test getting stats creates new referral for new user"""
        mock_collection = Mock()
        mock_document = Mock()
        mock_get = Mock()
        mock_get.exists = False
        
        mock_db.collection.return_value = mock_collection
        mock_collection.document.return_value = mock_document
        mock_document.get.return_value = mock_get
        
        response = client.get('/api/referral/stats?user_id=newuser')
        
        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] == True
        assert "referralCode" in data["data"]
        assert data["data"]["totalReferrals"] == 0
        assert mock_document.set.called
    
    def test_get_stats_missing_user_id(self, client):
        """Test stats without user_id"""
        response = client.get('/api/referral/stats')
        
        assert response.status_code == 400
        data = response.get_json()
        assert "error" in data
    
    def test_get_stats_empty_user_id(self, client):
        """Test stats with empty user_id"""
        response = client.get('/api/referral/stats?user_id=  ')
        
        assert response.status_code == 400
        data = response.get_json()
        assert "error" in data
    
    @patch('src.routes.referral_routes.db')
    def test_get_stats_database_error(self, mock_db, client):
        """Test stats when database fails"""
        mock_db.collection.side_effect = Exception("Database error")
        
        response = client.get('/api/referral/stats?user_id=test123')
        
        assert response.status_code == 500
        data = response.get_json()
        assert "error" in data
    
    def test_get_stats_options_request(self, client):
        """Test OPTIONS request for CORS"""
        response = client.options('/api/referral/stats')
        assert response.status_code == 204


class TestSendInvitation:
    """Tests for /invite endpoint"""
    
    @patch('src.services.email_service.email_service.send_referral_invitation')
    @patch('src.routes.referral_routes.db')
    def test_send_invitation_success(self, mock_db, mock_email, client):
        """Test sending invitation successfully"""
        referral_data = {
            "user_id": "test123",
            "referral_code": "TEST1234",
            "total_referrals": 5,
            "pending_referrals": 1
        }
        
        mock_collection = Mock()
        mock_document = Mock()
        mock_get = Mock()
        mock_get.exists = True
        mock_get.to_dict.return_value = referral_data
        
        mock_db.collection.return_value = mock_collection
        mock_collection.document.return_value = mock_document
        mock_document.get.return_value = mock_get
        
        mock_email.return_value = {"success": True, "message": "Email sent"}
        
        response = client.post('/api/referral/invite',
            json={
                "user_id": "test123",
                "email": "friend@example.com",
                "referrer_name": "Test User"
            },
            content_type='application/json'
        )
        
        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] == True
        assert data["data"]["emailSent"] == True
        assert mock_document.update.called
    
    def test_send_invitation_missing_fields(self, client):
        """Test invitation without required fields"""
        response = client.post('/api/referral/invite',
            json={"user_id": "test123"},
            content_type='application/json'
        )
        
        assert response.status_code == 400
        data = response.get_json()
        assert "error" in data
    
    def test_send_invitation_empty_email(self, client):
        """Test invitation with empty email"""
        response = client.post('/api/referral/invite',
            json={
                "user_id": "test123",
                "email": "  "
            },
            content_type='application/json'
        )
        
        assert response.status_code == 400
        data = response.get_json()
        assert "error" in data
    
    @patch('src.routes.referral_routes.db')
    def test_send_invitation_no_referral_code(self, mock_db, client):
        """Test invitation when user has no referral code"""
        mock_collection = Mock()
        mock_document = Mock()
        mock_get = Mock()
        mock_get.exists = False
        
        mock_db.collection.return_value = mock_collection
        mock_collection.document.return_value = mock_document
        mock_document.get.return_value = mock_get
        
        response = client.post('/api/referral/invite',
            json={
                "user_id": "test123",
                "email": "friend@example.com"
            },
            content_type='application/json'
        )
        
        assert response.status_code == 404
        data = response.get_json()
        assert "error" in data
    
    @patch('src.services.email_service.email_service.send_referral_invitation')
    @patch('src.routes.referral_routes.db')
    def test_send_invitation_email_failure(self, mock_db, mock_email, client):
        """Test invitation when email fails"""
        referral_data = {
            "user_id": "test123",
            "referral_code": "TEST1234",
            "total_referrals": 5,
            "pending_referrals": 1
        }
        
        mock_collection = Mock()
        mock_document = Mock()
        mock_get = Mock()
        mock_get.exists = True
        mock_get.to_dict.return_value = referral_data
        
        mock_db.collection.return_value = mock_collection
        mock_collection.document.return_value = mock_document
        mock_document.get.return_value = mock_get
        
        mock_email.return_value = {"success": False, "message": "Email service unavailable"}
        
        response = client.post('/api/referral/invite',
            json={
                "user_id": "test123",
                "email": "friend@example.com"
            },
            content_type='application/json'
        )
        
        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] == True
        assert data["data"]["emailSent"] == False
    
    @patch('src.routes.referral_routes.db')
    def test_send_invitation_database_error(self, mock_db, client):
        """Test invitation when database fails"""
        mock_db.collection.side_effect = Exception("Database error")
        
        response = client.post('/api/referral/invite',
            json={
                "user_id": "test123",
                "email": "friend@example.com"
            },
            content_type='application/json'
        )
        
        assert response.status_code == 500
        data = response.get_json()
        assert "error" in data
    
    def test_send_invitation_options_request(self, client):
        """Test OPTIONS request for CORS"""
        response = client.options('/api/referral/invite')
        assert response.status_code == 204


class TestCompleteReferral:
    """Tests for /complete endpoint"""
    
    @patch('src.services.push_notification_service.push_notification_service')
    @patch('src.services.email_service.email_service')
    @patch('src.routes.referral_routes.db')
    def test_complete_referral_bronze_tier(self, mock_db, mock_email, mock_push, client):
        """Test completing referral at Bronze tier (< 5 referrals)"""
        referral_data = {
            "user_id": "referrer123",
            "referral_code": "REF1234",
            "successful_referrals": 2,
            "pending_referrals": 1,
            "rewards_earned": 2
        }
        
        referrer_info = {
            "email": "referrer@example.com",
            "name": "Referrer User",
            "fcm_token": "token123"
        }
        
        # Mock referral document
        mock_collection = Mock()
        mock_referral_doc = Mock()
        mock_get_referral = Mock()
        mock_get_referral.exists = True
        mock_get_referral.to_dict.return_value = referral_data
        
        # Mock user document
        mock_user_doc = Mock()
        mock_get_user = Mock()
        mock_get_user.exists = True
        mock_get_user.to_dict.return_value = referrer_info
        
        def collection_side_effect(collection_name):
            if collection_name == "referrals":
                mock_referral_doc.get.return_value = mock_get_referral
                return Mock(document=Mock(return_value=mock_referral_doc))
            elif collection_name == "users":
                mock_user_doc.get.return_value = mock_get_user
                return Mock(document=Mock(return_value=mock_user_doc))
            else:
                return Mock(document=Mock(return_value=Mock()))
        
        mock_db.collection.side_effect = collection_side_effect
        
        response = client.post('/api/referral/complete',
            json={
                "referrer_id": "referrer123",
                "invitee_id": "invitee456",
                "invitee_name": "New User",
                "invitee_email": "new@example.com"
            },
            content_type='application/json'
        )
        
        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] == True
        assert data["data"]["successfulReferrals"] == 3
        assert data["data"]["rewardsEarned"] == 3  # 3 referrals = 3 weeks (Bronze tier)
    
    @patch('src.services.push_notification_service.push_notification_service')
    @patch('src.services.email_service.email_service')
    @patch('src.routes.referral_routes.db')
    def test_complete_referral_silver_tier(self, mock_db, mock_email, mock_push, client):
        """Test completing referral reaching Silver tier (5 referrals)"""
        referral_data = {
            "user_id": "referrer123",
            "referral_code": "REF1234",
            "successful_referrals": 4,
            "pending_referrals": 1,
            "rewards_earned": 4
        }
        
        referrer_info = {
            "email": "referrer@example.com",
            "name": "Referrer User",
            "fcm_token": "token123"
        }
        
        mock_collection = Mock()
        mock_referral_doc = Mock()
        mock_get_referral = Mock()
        mock_get_referral.exists = True
        mock_get_referral.to_dict.return_value = referral_data
        
        mock_user_doc = Mock()
        mock_get_user = Mock()
        mock_get_user.exists = True
        mock_get_user.to_dict.return_value = referrer_info
        
        def collection_side_effect(collection_name):
            if collection_name == "referrals":
                mock_referral_doc.get.return_value = mock_get_referral
                return Mock(document=Mock(return_value=mock_referral_doc))
            elif collection_name == "users":
                mock_user_doc.get.return_value = mock_get_user
                return Mock(document=Mock(return_value=mock_user_doc))
            else:
                return Mock(document=Mock(return_value=Mock()))
        
        mock_db.collection.side_effect = collection_side_effect
        
        response = client.post('/api/referral/complete',
            json={
                "referrer_id": "referrer123",
                "invitee_id": "invitee456",
                "invitee_name": "New User"
            },
            content_type='application/json'
        )
        
        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] == True
        assert data["data"]["successfulReferrals"] == 5
        # 5 referrals + 4 weeks Silver bonus = 9 weeks
        assert data["data"]["rewardsEarned"] == 9
    
    def test_complete_referral_missing_fields(self, client):
        """Test complete without required fields"""
        response = client.post('/api/referral/complete',
            json={"referrer_id": "test123"},
            content_type='application/json'
        )
        
        assert response.status_code == 400
        data = response.get_json()
        assert "error" in data
    
    @patch('src.routes.referral_routes.db')
    def test_complete_referral_referrer_not_found(self, mock_db, client):
        """Test complete when referrer doesn't exist"""
        mock_collection = Mock()
        mock_document = Mock()
        mock_get = Mock()
        mock_get.exists = False
        
        mock_db.collection.return_value = mock_collection
        mock_collection.document.return_value = mock_document
        mock_document.get.return_value = mock_get
        
        response = client.post('/api/referral/complete',
            json={
                "referrer_id": "unknown",
                "invitee_id": "invitee456"
            },
            content_type='application/json'
        )
        
        assert response.status_code == 404
        data = response.get_json()
        assert "error" in data
    
    @patch('src.routes.referral_routes.db')
    def test_complete_referral_database_error(self, mock_db, client):
        """Test complete when database fails"""
        mock_db.collection.side_effect = Exception("Database error")
        
        response = client.post('/api/referral/complete',
            json={
                "referrer_id": "referrer123",
                "invitee_id": "invitee456"
            },
            content_type='application/json'
        )
        
        assert response.status_code == 500
        data = response.get_json()
        assert "error" in data
    
    def test_complete_referral_options_request(self, client):
        """Test OPTIONS request for CORS"""
        response = client.options('/api/referral/complete')
        assert response.status_code == 204


class TestLeaderboard:
    """Tests for /leaderboard endpoint"""
    
    @patch('src.routes.referral_routes.db')
    def test_get_leaderboard_success(self, mock_db, client):
        """Test getting leaderboard"""
        # Mock referrals
        referral1 = Mock()
        referral1.to_dict.return_value = {
            "user_id": "user1",
            "successful_referrals": 50,
            "rewards_earned": 100
        }
        referral2 = Mock()
        referral2.to_dict.return_value = {
            "user_id": "user2",
            "successful_referrals": 20,
            "rewards_earned": 40
        }
        
        # Mock users
        user1 = Mock()
        user1.exists = True
        user1.to_dict.return_value = {"name": "Top Referrer"}
        user2 = Mock()
        user2.exists = True
        user2.to_dict.return_value = {"name": "Good Referrer"}
        
        mock_collection = Mock()
        mock_query = Mock()
        mock_query.limit.return_value.get.return_value = [referral1, referral2]
        mock_collection.order_by.return_value = mock_query
        
        def collection_side_effect(collection_name):
            if collection_name == "referrals":
                return mock_collection
            elif collection_name == "users":
                def document_side_effect(user_id):
                    if user_id == "user1":
                        return Mock(get=Mock(return_value=user1))
                    elif user_id == "user2":
                        return Mock(get=Mock(return_value=user2))
                return Mock(document=Mock(side_effect=document_side_effect))
        
        mock_db.collection.side_effect = collection_side_effect
        
        response = client.get('/api/referral/leaderboard')
        
        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] == True
        assert len(data["data"]["leaderboard"]) == 2
        assert data["data"]["leaderboard"][0]["tier"] == "Platinum"  # 50 referrals
        assert data["data"]["leaderboard"][1]["tier"] == "Gold"     # 20 referrals
    
    @patch('src.routes.referral_routes.db')
    def test_get_leaderboard_with_limit(self, mock_db, client):
        """Test leaderboard with custom limit"""
        mock_collection = Mock()
        mock_query = Mock()
        mock_query.limit.return_value.get.return_value = []
        mock_collection.order_by.return_value = mock_query
        mock_db.collection.return_value = mock_collection
        
        response = client.get('/api/referral/leaderboard?limit=5')
        
        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] == True
        mock_query.limit.assert_called_with(5)
    
    @patch('src.routes.referral_routes.db')
    def test_get_leaderboard_max_limit(self, mock_db, client):
        """Test leaderboard limits to 100 max"""
        mock_collection = Mock()
        mock_query = Mock()
        mock_query.limit.return_value.get.return_value = []
        mock_collection.order_by.return_value = mock_query
        mock_db.collection.return_value = mock_collection
        
        response = client.get('/api/referral/leaderboard?limit=200')
        
        assert response.status_code == 200
        mock_query.limit.assert_called_with(100)  # Should cap at 100
    
    @patch('src.routes.referral_routes.db')
    def test_get_leaderboard_database_error(self, mock_db, client):
        """Test leaderboard when database fails"""
        mock_db.collection.side_effect = Exception("Database error")
        
        response = client.get('/api/referral/leaderboard')
        
        assert response.status_code == 500
        data = response.get_json()
        assert "error" in data
    
    def test_get_leaderboard_options_request(self, client):
        """Test OPTIONS request for CORS"""
        response = client.options('/api/referral/leaderboard')
        assert response.status_code == 204


class TestReferralHistory:
    """Tests for /history endpoint"""
    
    @patch('src.routes.referral_routes.db')
    def test_get_history_success(self, mock_db, client):
        """Test getting referral history"""
        history1 = Mock()
        history1.to_dict.return_value = {
            "invitee_name": "User One",
            "invitee_email": "user1@example.com",
            "completed_at": "2024-01-01T10:00:00Z",
            "rewards_granted": 1
        }
        history2 = Mock()
        history2.to_dict.return_value = {
            "invitee_name": "User Two",
            "invitee_email": "user2@example.com",
            "completed_at": "2024-01-02T10:00:00Z",
            "rewards_granted": 1
        }
        
        mock_collection = Mock()
        mock_query = Mock()
        mock_query.get.return_value = [history1, history2]
        mock_collection.where.return_value = mock_query
        mock_db.collection.return_value = mock_collection
        
        response = client.get('/api/referral/history?user_id=newuser')
        
        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] == True
        assert len(data["data"]["history"]) == 2
        assert data["data"]["totalCount"] == 2
        assert data["data"]["history"][0]["inviteeName"] == "User Two"
        assert data["data"]["history"][1]["inviteeName"] == "User One"
    
    def test_get_history_missing_user_id(self, client):
        """Test history without user_id"""
        response = client.get('/api/referral/history')
        
        assert response.status_code == 400
        data = response.get_json()
        assert "error" in data
    
    @patch('src.routes.referral_routes.db')
    def test_get_history_no_referrals(self, mock_db, client):
        """Test history when user has no referrals"""
        mock_collection = Mock()
        mock_query = Mock()
        mock_query.get.return_value = []
        mock_collection.where.return_value = mock_query
        mock_db.collection.return_value = mock_collection
        
        response = client.get('/api/referral/history?user_id=newuser')
        
        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] == True
        assert len(data["data"]["history"]) == 0
    
    @patch('src.routes.referral_routes.db')
    def test_get_history_database_error(self, mock_db, client):
        """Test history when database fails"""
        mock_db.collection.side_effect = Exception("Database error")
        
        response = client.get('/api/referral/history?user_id=test123')
        
        assert response.status_code == 500
        data = response.get_json()
        assert "error" in data
    
    def test_get_history_options_request(self, client):
        """Test OPTIONS request for CORS"""
        response = client.options('/api/referral/history')
        assert response.status_code == 204


class TestRewardsCatalog:
    """Tests for /rewards/catalog endpoint"""
    
    def test_get_rewards_catalog(self, client):
        """Test getting rewards catalog"""
        response = client.get('/api/referral/rewards/catalog')
        
        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] == True
        assert "rewards" in data["data"]
        assert len(data["data"]["rewards"]) > 0
        
        # Check structure of first reward
        reward = data["data"]["rewards"][0]
        assert "id" in reward
        assert "name" in reward
        assert "cost" in reward
        assert "description" in reward
    
    def test_get_rewards_catalog_options_request(self, client):
        """Test OPTIONS request for CORS"""
        response = client.options('/api/referral/rewards/catalog')
        assert response.status_code == 204


class TestRedeemReward:
    """Tests for /rewards/redeem endpoint"""
    
    @patch('src.routes.referral_routes.db')
    def test_redeem_reward_success(self, mock_db, client):
        """Test redeeming a reward successfully"""
        referral_data = {
            "user_id": "test123",
            "rewards_earned": 10
        }
        
        mock_collection = Mock()
        mock_document = Mock()
        mock_get = Mock()
        mock_get.exists = True
        mock_get.to_dict.return_value = referral_data
        
        mock_db.collection.return_value = mock_collection
        mock_collection.document.return_value = mock_document
        mock_document.get.return_value = mock_get
        
        response = client.post('/api/referral/rewards/redeem',
            json={
                "user_id": "test123",
                "reward_id": "premium_1month"
            },
            content_type='application/json'
        )
        
        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] == True
        assert data["data"]["newBalance"] == 6  # 10 - 4 (cost of 1 month)
        assert mock_document.update.called
    
    @patch('src.routes.referral_routes.db')
    def test_redeem_reward_insufficient_balance(self, mock_db, client):
        """Test redeeming when user doesn't have enough rewards"""
        referral_data = {
            "user_id": "test123",
            "rewards_earned": 2
        }
        
        mock_collection = Mock()
        mock_document = Mock()
        mock_get = Mock()
        mock_get.exists = True
        mock_get.to_dict.return_value = referral_data
        
        mock_db.collection.return_value = mock_collection
        mock_collection.document.return_value = mock_document
        mock_document.get.return_value = mock_get
        
        response = client.post('/api/referral/rewards/redeem',
            json={
                "user_id": "test123",
                "reward_id": "premium_1month"  # costs 4 weeks
            },
            content_type='application/json'
        )
        
        assert response.status_code == 400
        data = response.get_json()
        assert data["error"] == "INSUFFICIENT_BALANCE"
        assert "Insufficient rewards" in data["message"]
        assert data["details"]["available"] == 2
        assert data["details"]["required"] == 4
    
    def test_redeem_reward_invalid_reward_id(self, client):
        """Test redeeming with invalid reward_id"""
        with patch('src.routes.referral_routes.db') as mock_db:
            referral_data = {
                "user_id": "test123",
                "rewards_earned": 10
            }
            
            mock_collection = Mock()
            mock_document = Mock()
            mock_get = Mock()
            mock_get.exists = True
            mock_get.to_dict.return_value = referral_data
            
            mock_db.collection.return_value = mock_collection
            mock_collection.document.return_value = mock_document
            mock_document.get.return_value = mock_get
            
            response = client.post('/api/referral/rewards/redeem',
                json={
                    "user_id": "test123",
                    "reward_id": "invalid_reward"
                },
                content_type='application/json'
            )
            
            assert response.status_code == 400
            data = response.get_json()
            assert data["error"] == "BAD_REQUEST"
            assert "Invalid reward_id" in data["message"]
    
    def test_redeem_reward_missing_fields(self, client):
        """Test redeem without required fields"""
        response = client.post('/api/referral/rewards/redeem',
            json={"user_id": "test123"},
            content_type='application/json'
        )
        
        assert response.status_code == 400
        data = response.get_json()
        assert "error" in data
    
    @patch('src.routes.referral_routes.db')
    def test_redeem_reward_no_referral_data(self, mock_db, client):
        """Test redeem when user has no referral data"""
        mock_collection = Mock()
        mock_document = Mock()
        mock_get = Mock()
        mock_get.exists = False
        
        mock_db.collection.return_value = mock_collection
        mock_collection.document.return_value = mock_document
        mock_document.get.return_value = mock_get
        
        response = client.post('/api/referral/rewards/redeem',
            json={
                "user_id": "test123",
                "reward_id": "premium_1week"
            },
            content_type='application/json'
        )
        
        assert response.status_code == 404
        data = response.get_json()
        assert "error" in data
    
    @patch('src.routes.referral_routes.db')
    def test_redeem_reward_database_error(self, mock_db, client):
        """Test redeem when database fails"""
        mock_db.collection.side_effect = Exception("Database error")
        
        response = client.post('/api/referral/rewards/redeem',
            json={
                "user_id": "test123",
                "reward_id": "premium_1week"
            },
            content_type='application/json'
        )
        
        assert response.status_code == 500
        data = response.get_json()
        assert "error" in data
    
    def test_redeem_reward_options_request(self, client):
        """Test OPTIONS request for CORS"""
        response = client.options('/api/referral/rewards/redeem')
        assert response.status_code == 204


class TestHelperFunctions:
    """Tests for helper functions"""
    
    def test_generate_referral_code(self):
        """Test referral code generation"""
        from src.routes.referral_routes import generate_referral_code
        
        code = generate_referral_code("test1234")
        
        assert len(code) == 8
        assert code[:4] == "TEST"  # First 4 chars uppercased
        assert code[4:].isupper()  # Last 4 chars are uppercase
        assert code[4:].isalpha()  # Last 4 chars are letters
    
    def test_generate_referral_code_unique(self):
        """Test that referral codes are unique"""
        from src.routes.referral_routes import generate_referral_code
        
        codes = [generate_referral_code("user123") for _ in range(10)]
        
        # At least some should be unique (random component)
        assert len(set(codes)) > 1
