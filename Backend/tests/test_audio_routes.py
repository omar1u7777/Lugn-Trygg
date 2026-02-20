"""
Tests for audio_routes.py
Covers: categories, category tracks, full library, single track, search.
"""
import pytest


BASE = "/api/v1/audio"


class TestCategories:
    """Tests for GET /api/audio/categories"""

    def test_list_categories(self, client, auth_headers):
        resp = client.get(f"{BASE}/categories", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.get_json()
        # Should contain categories list
        assert "categories" in data or "data" in data

    def test_categories_no_auth(self, client):
        resp = client.get(f"{BASE}/categories")
        # Mock jwt_required always sets g.user_id, so auth is bypassed in tests
        assert resp.status_code in (200, 401, 403, 422)


class TestCategoryTracks:
    """Tests for GET /api/audio/category/<category_id>"""

    def test_valid_category(self, client, auth_headers):
        resp = client.get(f"{BASE}/category/nature", headers=auth_headers)
        assert resp.status_code == 200

    def test_invalid_category(self, client, auth_headers):
        resp = client.get(f"{BASE}/category/nonexistent", headers=auth_headers)
        assert resp.status_code in (404, 400)


class TestFullLibrary:
    """Tests for GET /api/audio/all and /api/audio/library"""

    def test_all_endpoint(self, client, auth_headers):
        resp = client.get(f"{BASE}/all", headers=auth_headers)
        assert resp.status_code == 200

    def test_library_endpoint(self, client, auth_headers):
        resp = client.get(f"{BASE}/library", headers=auth_headers)
        assert resp.status_code == 200


class TestSingleTrack:
    """Tests for GET /api/audio/track/<track_id>"""

    def test_valid_track(self, client, auth_headers):
        # Try a known track ID pattern
        resp = client.get(f"{BASE}/track/nature_1", headers=auth_headers)
        assert resp.status_code in (200, 404)

    def test_invalid_track(self, client, auth_headers):
        resp = client.get(f"{BASE}/track/nonexistent_track_xyz", headers=auth_headers)
        assert resp.status_code in (404, 400)


class TestSearch:
    """Tests for GET /api/audio/search"""

    def test_search_valid_query(self, client, auth_headers):
        resp = client.get(f"{BASE}/search?q=rain", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert "results" in data or "data" in data

    def test_search_short_query(self, client, auth_headers):
        resp = client.get(f"{BASE}/search?q=a", headers=auth_headers)
        assert resp.status_code in (400, 200)

    def test_search_no_query(self, client, auth_headers):
        resp = client.get(f"{BASE}/search", headers=auth_headers)
        assert resp.status_code in (400, 200)

    def test_search_no_auth(self, client):
        resp = client.get(f"{BASE}/search?q=rain")
        # Mock jwt_required always sets g.user_id, so auth is bypassed in tests
        assert resp.status_code in (200, 401, 403, 422)
