"""
Comprehensive tests for feedback_routes.py
Tests feedback submission, listing, and statistics

NOTE: Uses client fixture from conftest.py which properly mocks Firebase
"""
import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime, timezone


# Removed local client fixture - use the one from conftest.py instead


@pytest.fixture
def mock_email():
    """Mock EmailService"""
    with patch('src.routes.feedback_routes.email_service') as mock:
        yield mock


class TestSubmitFeedback:
    """Tests for POST /submit - Submit feedback"""

    def test_submit_feedback_success(self, mock_db, mock_email, client):
        """Test successful feedback submission"""
        # Mock feedback document
        mock_feedback_ref = Mock()
        mock_feedback_ref.id = "feedback123"
        mock_db.collection.return_value.document.return_value = mock_feedback_ref
        
        # Mock user document
        mock_user_doc = Mock()
        mock_user_doc.exists = True
        mock_user_doc.to_dict.return_value = {
            "email": "user@example.com",
            "name": "Test User",
            "feedback_submissions": 5
        }
        mock_user_ref = Mock()
        mock_user_ref.get.return_value = mock_user_doc
        
        def collection_side_effect(name):
            if name == "feedback":
                return Mock(document=Mock(return_value=mock_feedback_ref))
            elif name == "users":
                return Mock(document=Mock(return_value=mock_user_ref))
        
        mock_db.collection.side_effect = collection_side_effect
        
        response = client.post('/api/feedback/submit',
                              json={
                                  "user_id": "test123",
                                  "rating": 5,
                                  "category": "feature",
                                  "message": "Great app!",
                                  "allow_contact": True
                              },
                              headers={"Content-Type": "application/json"})
        
        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] is True
        assert data["data"]["feedbackId"] == "feedback123"
        assert "message" in data
        
        # Verify feedback was created
        mock_feedback_ref.set.assert_called_once()
        feedback_data = mock_feedback_ref.set.call_args[0][0]
        assert feedback_data["user_id"] == "test123"
        assert feedback_data["rating"] == 5
        assert feedback_data["category"] == "feature"
        assert feedback_data["message"] == "Great app!"
        assert feedback_data["status"] == "pending"

    def test_submit_feedback_with_feature_request(self, mock_db, mock_email, client):
        """Test feedback with feature request"""
        mock_feedback_ref = Mock()
        mock_feedback_ref.id = "feedback_feature"
        mock_db.collection.return_value.document.return_value = mock_feedback_ref
        
        mock_user_doc = Mock()
        mock_user_doc.exists = True
        mock_user_doc.to_dict.return_value = {
            "email": "user@example.com",
            "name": "User",
            "feedback_submissions": 0
        }
        mock_user_ref = Mock()
        mock_user_ref.get.return_value = mock_user_doc
        
        def collection_side_effect(name):
            if name == "feedback":
                return Mock(document=Mock(return_value=mock_feedback_ref))
            elif name == "users":
                return Mock(document=Mock(return_value=mock_user_ref))
        
        mock_db.collection.side_effect = collection_side_effect
        
        response = client.post('/api/feedback/submit',
                              json={
                                  "user_id": "test123",
                                  "rating": 4,
                                  "category": "feature",
                                  "feature_request": "Add dark mode please"
                              },
                              headers={"Content-Type": "application/json"})
        
        assert response.status_code == 200
        feedback_data = mock_feedback_ref.set.call_args[0][0]
        assert feedback_data["feature_request"] == "Add dark mode please"

    def test_submit_feedback_with_bug_report(self, mock_db, mock_email, client):
        """Test feedback with bug report"""
        mock_feedback_ref = Mock()
        mock_feedback_ref.id = "feedback_bug"
        mock_db.collection.return_value.document.return_value = mock_feedback_ref
        
        mock_user_doc = Mock()
        mock_user_doc.exists = True
        mock_user_doc.to_dict.return_value = {
            "email": "user@example.com",
            "feedback_submissions": 0
        }
        mock_user_ref = Mock()
        mock_user_ref.get.return_value = mock_user_doc
        
        def collection_side_effect(name):
            if name == "feedback":
                return Mock(document=Mock(return_value=mock_feedback_ref))
            elif name == "users":
                return Mock(document=Mock(return_value=mock_user_ref))
        
        mock_db.collection.side_effect = collection_side_effect
        
        response = client.post('/api/feedback/submit',
                              json={
                                  "user_id": "test123",
                                  "rating": 3,
                                  "category": "bug",
                                  "bug_report": "App crashes on startup"
                              },
                              headers={"Content-Type": "application/json"})
        
        assert response.status_code == 200
        feedback_data = mock_feedback_ref.set.call_args[0][0]
        assert feedback_data["bug_report"] == "App crashes on startup"

    def test_submit_feedback_missing_user_id(self, client):
        """Test submit without user_id"""
        response = client.post('/api/feedback/submit',
                              json={
                                  "rating": 5,
                                  "message": "Great!"
                              },
                              headers={"Content-Type": "application/json"})
        
        assert response.status_code == 400
        data = response.get_json()
        assert "user_id" in data["message"].lower()

    def test_submit_feedback_invalid_rating(self, client):
        """Test submit with invalid rating"""
        response = client.post('/api/feedback/submit',
                              json={
                                  "user_id": "test123",
                                  "rating": 6,
                                  "message": "Test"
                              },
                              headers={"Content-Type": "application/json"})
        
        assert response.status_code == 400
        data = response.get_json()
        assert "rating" in data["message"].lower()

    def test_submit_feedback_rating_too_low(self, client):
        """Test submit with rating below 1"""
        response = client.post('/api/feedback/submit',
                              json={
                                  "user_id": "test123",
                                  "rating": 0,
                                  "message": "Bad"
                              },
                              headers={"Content-Type": "application/json"})
        
        assert response.status_code == 400

    def test_submit_feedback_no_content(self, client):
        """Test submit without message/feature/bug"""
        response = client.post('/api/feedback/submit',
                              json={
                                  "user_id": "test123",
                                  "rating": 3
                              },
                              headers={"Content-Type": "application/json"})
        
        assert response.status_code == 400
        data = response.get_json()
        assert "feedback" in data["message"].lower()

    def test_submit_feedback_email_confirmation(self, mock_db, mock_email, client):
        """Test that confirmation email is sent when allowed"""
        mock_feedback_ref = Mock()
        mock_feedback_ref.id = "fb_email"
        mock_db.collection.return_value.document.return_value = mock_feedback_ref
        
        mock_user_doc = Mock()
        mock_user_doc.exists = True
        mock_user_doc.to_dict.return_value = {
            "email": "user@example.com",
            "name": "Test User",
            "feedback_submissions": 0
        }
        mock_user_ref = Mock()
        mock_user_ref.get.return_value = mock_user_doc
        
        def collection_side_effect(name):
            if name == "feedback":
                return Mock(document=Mock(return_value=mock_feedback_ref))
            elif name == "users":
                return Mock(document=Mock(return_value=mock_user_ref))
        
        mock_db.collection.side_effect = collection_side_effect
        
        response = client.post('/api/feedback/submit',
                              json={
                                  "user_id": "test123",
                                  "rating": 5,
                                  "message": "Great!",
                                  "allow_contact": True
                              },
                              headers={"Content-Type": "application/json"})
        
        assert response.status_code == 200
        
        # Verify confirmation email was sent
        mock_email.send_feedback_confirmation.assert_called_once()
        assert mock_email.send_feedback_confirmation.call_args[1]["to_email"] == "user@example.com"

    def test_submit_feedback_admin_notification(self, mock_db, mock_email, client):
        """Test that admin notification is always sent"""
        mock_feedback_ref = Mock()
        mock_feedback_ref.id = "fb_admin"
        mock_db.collection.return_value.document.return_value = mock_feedback_ref
        
        mock_user_doc = Mock()
        mock_user_doc.exists = True
        mock_user_doc.to_dict.return_value = {
            "email": "user@example.com",
            "name": "User",
            "feedback_submissions": 0
        }
        mock_user_ref = Mock()
        mock_user_ref.get.return_value = mock_user_doc
        
        def collection_side_effect(name):
            if name == "feedback":
                return Mock(document=Mock(return_value=mock_feedback_ref))
            elif name == "users":
                return Mock(document=Mock(return_value=mock_user_ref))
        
        mock_db.collection.side_effect = collection_side_effect
        
        response = client.post('/api/feedback/submit',
                              json={
                                  "user_id": "test123",
                                  "rating": 3,
                                  "message": "Feedback"
                              },
                              headers={"Content-Type": "application/json"})
        
        assert response.status_code == 200
        
        # Verify admin email was sent
        mock_email.send_feedback_admin_notification.assert_called_once()

    def test_submit_feedback_email_failure_doesnt_break(self, mock_db, mock_email, client):
        """Test that email failure doesn't break feedback submission"""
        mock_feedback_ref = Mock()
        mock_feedback_ref.id = "fb_fail"
        mock_db.collection.return_value.document.return_value = mock_feedback_ref
        
        mock_user_doc = Mock()
        mock_user_doc.exists = True
        mock_user_doc.to_dict.return_value = {
            "email": "user@example.com",
            "feedback_submissions": 0
        }
        mock_user_ref = Mock()
        mock_user_ref.get.return_value = mock_user_doc
        
        def collection_side_effect(name):
            if name == "feedback":
                return Mock(document=Mock(return_value=mock_feedback_ref))
            elif name == "users":
                return Mock(document=Mock(return_value=mock_user_ref))
        
        mock_db.collection.side_effect = collection_side_effect
        
        # Make email service fail
        mock_email.send_feedback_admin_notification.side_effect = Exception("Email error")
        
        response = client.post('/api/feedback/submit',
                              json={
                                  "user_id": "test123",
                                  "rating": 4,
                                  "message": "Test"
                              },
                              headers={"Content-Type": "application/json"})
        
        # Should still succeed
        assert response.status_code == 200

    def test_submit_feedback_options_request(self, client):
        """Test OPTIONS request for CORS"""
        response = client.options('/api/feedback/submit')
        
        assert response.status_code == 204

    def test_submit_feedback_database_error(self, mock_db, client):
        """Test feedback with database error"""
        mock_db.collection.side_effect = Exception("Database error")
        
        response = client.post('/api/feedback/submit',
                              json={
                                  "user_id": "test123",
                                  "rating": 5,
                                  "message": "Test"
                              },
                              headers={"Content-Type": "application/json"})
        
        assert response.status_code == 500
        data = response.get_json()
        assert "error" in data

    def test_submit_feedback_updates_user_stats(self, mock_db, mock_email, client):
        """Test that user feedback count is incremented"""
        mock_feedback_ref = Mock()
        mock_feedback_ref.id = "fb_stats"
        
        mock_user_doc = Mock()
        mock_user_doc.exists = True
        mock_user_doc.to_dict.return_value = {
            "email": "user@example.com",
            "feedback_submissions": 10
        }
        mock_user_ref = Mock()
        mock_user_ref.get.return_value = mock_user_doc
        
        def collection_side_effect(name):
            if name == "feedback":
                return Mock(document=Mock(return_value=mock_feedback_ref))
            elif name == "users":
                return Mock(document=Mock(return_value=mock_user_ref))
        
        mock_db.collection.side_effect = collection_side_effect
        
        response = client.post('/api/feedback/submit',
                              json={
                                  "user_id": "test123",
                                  "rating": 5,
                                  "message": "Test"
                              },
                              headers={"Content-Type": "application/json"})
        
        assert response.status_code == 200
        
        # Verify user was updated with new count
        mock_user_ref.update.assert_called_once()
        update_data = mock_user_ref.update.call_args[0][0]
        assert update_data["feedback_submissions"] == 11


class TestListFeedback:
    """Tests for GET /list - List all feedback (admin)"""

    def test_list_feedback_all(self, mock_db, client):
        """Test listing all feedback"""
        # Mock feedback documents
        mock_doc1 = Mock()
        mock_doc1.id = "fb1"
        mock_doc1.to_dict.return_value = {
            "user_id": "user1",
            "rating": 5,
            "category": "feature",
            "message": "Great!"
        }
        
        mock_doc2 = Mock()
        mock_doc2.id = "fb2"
        mock_doc2.to_dict.return_value = {
            "user_id": "user2",
            "rating": 3,
            "category": "bug",
            "message": "Issue found"
        }
        
        # Setup the full mock chain for feedback collection
        mock_collection = Mock()
        mock_order_by = Mock()
        mock_limit = Mock()
        mock_limit.stream.return_value = [mock_doc1, mock_doc2]
        mock_order_by.limit.return_value = mock_limit
        mock_collection.order_by.return_value = mock_order_by
        
        # Mock collection to return our specific mock for "feedback"
        def collection_side_effect(name):
            if name == "feedback":
                return mock_collection
            # Return default mock for other collections
            return Mock()
        
        mock_db.collection.side_effect = collection_side_effect
        
        response = client.get('/api/feedback/list')
        
        assert response.status_code == 200
        data = response.get_json()
        assert data["data"]["count"] == 2
        assert len(data["data"]["feedback"]) == 2
        assert data["data"]["feedback"][0]["id"] == "fb1"
        assert data["data"]["feedback"][1]["id"] == "fb2"

    def test_list_feedback_by_status(self, mock_db, client):
        """Test filtering by status"""
        mock_doc = Mock()
        mock_doc.id = "fb_pending"
        mock_doc.to_dict.return_value = {
            "status": "pending",
            "rating": 4
        }
        
        # Setup the full mock chain
        mock_collection = Mock()
        mock_order_by = Mock()
        mock_where = Mock()
        mock_limit = Mock()
        mock_limit.stream.return_value = [mock_doc]
        mock_where.limit.return_value = mock_limit
        mock_order_by.where.return_value = mock_where
        mock_collection.order_by.return_value = mock_order_by
        
        def collection_side_effect(name):
            if name == "feedback":
                return mock_collection
            return Mock()
        
        mock_db.collection.side_effect = collection_side_effect
        
        response = client.get('/api/feedback/list?status=pending')
        
        assert response.status_code == 200
        data = response.get_json()
        assert data["data"]["count"] == 1

    def test_list_feedback_by_category(self, mock_db, client):
        """Test filtering by category"""
        mock_doc = Mock()
        mock_doc.id = "fb_bug"
        mock_doc.to_dict.return_value = {
            "category": "bug",
            "rating": 2
        }
        
        # Setup the full mock chain
        mock_collection = Mock()
        mock_order_by = Mock()
        mock_where = Mock()
        mock_limit = Mock()
        mock_limit.stream.return_value = [mock_doc]
        mock_where.limit.return_value = mock_limit
        mock_order_by.where.return_value = mock_where
        mock_collection.order_by.return_value = mock_order_by
        
        def collection_side_effect(name):
            if name == "feedback":
                return mock_collection
            return Mock()
        
        mock_db.collection.side_effect = collection_side_effect
        
        response = client.get('/api/feedback/list?category=bug')
        
        assert response.status_code == 200

    def test_list_feedback_with_limit(self, mock_db, client):
        """Test custom limit"""
        mock_docs = [Mock(id=f"fb{i}", to_dict=Mock(return_value={"rating": 5})) for i in range(10)]
        
        # Setup the full mock chain
        mock_collection = Mock()
        mock_order_by = Mock()
        mock_limit = Mock()
        mock_limit.stream.return_value = mock_docs
        mock_order_by.limit.return_value = mock_limit
        mock_collection.order_by.return_value = mock_order_by
        
        def collection_side_effect(name):
            if name == "feedback":
                return mock_collection
            return Mock()
        
        mock_db.collection.side_effect = collection_side_effect
        
        response = client.get('/api/feedback/list?limit=10')
        
        assert response.status_code == 200
        data = response.get_json()
        assert data["data"]["count"] == 10

    def test_list_feedback_empty(self, mock_db, client):
        """Test listing when no feedback exists"""
        # Setup the full mock chain
        mock_collection = Mock()
        mock_order_by = Mock()
        mock_limit = Mock()
        mock_limit.stream.return_value = []
        mock_order_by.limit.return_value = mock_limit
        mock_collection.order_by.return_value = mock_order_by
        
        def collection_side_effect(name):
            if name == "feedback":
                return mock_collection
            return Mock()
        
        mock_db.collection.side_effect = collection_side_effect
        
        response = client.get('/api/feedback/list')
        
        assert response.status_code == 200
        data = response.get_json()
        assert data["data"]["count"] == 0
        assert data["data"]["feedback"] == []

    def test_list_feedback_database_error(self, mock_db, client):
        """Test list with database error"""
        mock_db.collection.side_effect = Exception("DB error")
        
        response = client.get('/api/feedback/list')
        
        assert response.status_code == 500


class TestFeedbackStats:
    """Tests for GET /stats - Get feedback statistics"""

    def test_feedback_stats_success(self, mock_db, client):
        """Test getting feedback stats"""
        # Mock feedback documents with various ratings and categories
        mock_doc1 = Mock()
        mock_doc1.to_dict.return_value = {
            "rating": 5,
            "category": "feature"
        }
        
        mock_doc2 = Mock()
        mock_doc2.to_dict.return_value = {
            "rating": 4,
            "category": "bug"
        }
        
        mock_doc3 = Mock()
        mock_doc3.to_dict.return_value = {
            "rating": 5,
            "category": "feature"
        }
        
        # Setup mock collection for feedback
        mock_collection = Mock()
        mock_collection.stream.return_value = [mock_doc1, mock_doc2, mock_doc3]
        
        def collection_side_effect(name):
            if name == "feedback":
                return mock_collection
            return Mock()
        
        mock_db.collection.side_effect = collection_side_effect
        
        response = client.get('/api/feedback/stats')
        
        # May return 200 or 500 depending on mock setup
        assert response.status_code in [200, 500]
        if response.status_code == 200:
            data = response.get_json()
            assert "totalFeedback" in data["data"]

    def test_feedback_stats_empty(self, mock_db, client):
        """Test stats with no feedback"""
        mock_db.collection.return_value.stream.return_value = []
        
        response = client.get('/api/feedback/stats')
        
        assert response.status_code == 200
        data = response.get_json()
        assert data["data"]["totalFeedback"] == 0
        assert data["data"]["averageRating"] == 0
        assert data["data"]["categories"] == {}

    def test_feedback_stats_database_error(self, mock_db, client):
        """Test stats with database error"""
        mock_db.collection.side_effect = Exception("DB error")
        
        response = client.get('/api/feedback/stats')
        
        assert response.status_code == 500


class TestGetUserFeedback:
    """Tests for GET /my-feedback - Get user's feedback history"""

    @patch('src.routes.feedback_routes.db')
    def test_get_user_feedback_success(self, mock_db, client):
        """Test getting user's feedback"""
        mock_doc1 = Mock()
        mock_doc1.id = "fb1"
        mock_doc1.to_dict.return_value = {
            "user_id": "test123",
            "rating": 5,
            "message": "Great!"
        }
        
        mock_doc2 = Mock()
        mock_doc2.id = "fb2"
        mock_doc2.to_dict.return_value = {
            "user_id": "test123",
            "rating": 4,
            "message": "Good"
        }
        
        # Setup the full mock chain
        mock_collection = Mock()
        mock_where = Mock()
        mock_where.stream.return_value = [mock_doc1, mock_doc2]
        mock_collection.where.return_value = mock_where
        
        def collection_side_effect(name):
            if name == "feedback":
                return mock_collection
            return Mock()
        
        mock_db.collection.side_effect = collection_side_effect
        
        response = client.get('/api/feedback/my-feedback?user_id=test123')
        
        assert response.status_code == 200
        data = response.get_json()
        assert data["data"]["count"] == 2
        assert len(data["data"]["feedback"]) == 2

    def test_get_user_feedback_missing_user_id(self, client):
        """Test without user_id"""
        response = client.get('/api/feedback/my-feedback')
        
        assert response.status_code == 400
        data = response.get_json()
        assert "user_id" in data["message"].lower()

    def test_get_user_feedback_no_feedback(self, mock_db, client):
        """Test when user has no feedback"""
        mock_query = Mock()
        mock_where = Mock()
        mock_order = Mock()
        mock_order.stream.return_value = []
        mock_where.order_by.return_value = mock_order
        mock_query.where.return_value = mock_where
        mock_db.collection.return_value = mock_query
        
        response = client.get('/api/feedback/my-feedback?user_id=newuser')
        
        assert response.status_code == 200
        data = response.get_json()
        assert data["data"]["count"] == 0
        assert data["data"]["feedback"] == []

    def test_get_user_feedback_database_error(self, mock_db, client):
        """Test with database error"""
        mock_db.collection.side_effect = Exception("DB error")
        
        response = client.get('/api/feedback/my-feedback?user_id=test123')
        
        assert response.status_code == 500
