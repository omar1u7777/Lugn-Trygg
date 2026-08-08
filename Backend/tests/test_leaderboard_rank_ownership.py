"""A user may only read their own leaderboard ranking.

The leaderboard anonymises display names but returns each entry's raw userId.
Without an ownership check on the rank endpoint, any signed-in user could take
those ids and read every other user's streak and mood_count — i.e. how much
someone engages with a mental-health service — which defeats the anonymisation
the leaderboard is built around.
"""

from unittest.mock import patch

BASE = "/api/v1/leaderboard"

# conftest authenticates requests as this user.
SELF = "testuser1234567890ab"
OTHER = "someoneelseAAAA456789ab"  # 20+ alnum, matches USER_ID_PATTERN


class TestUserRankOwnership:
    def test_cannot_read_another_users_ranking(self, client):
        resp = client.get(f"{BASE}/user/{OTHER}")
        assert resp.status_code == 403

    def test_cannot_read_another_users_ranking_via_rank_alias(self, client):
        # The same handler is registered under two paths; both must be closed.
        resp = client.get(f"{BASE}/user/{OTHER}/rank")
        assert resp.status_code == 403

    def test_reading_own_ranking_is_still_allowed(self, client, mock_db):
        user_doc = type("D", (), {"exists": True, "to_dict": lambda self: {"current_streak": 3, "mood_count": 7}})()
        rewards_doc = type("D", (), {"exists": True, "to_dict": lambda self: {"xp": 100}})()

        def _collection(name):
            col = type("C", (), {})()
            col.document = lambda _id: type(
                "R", (), {"get": lambda self: rewards_doc if name == "user_rewards" else user_doc}
            )()
            col.where = lambda **kwargs: type("Q", (), {"get": lambda self: []})()
            col.limit = lambda n: type("Q", (), {"get": lambda self: []})()
            return col

        with patch.object(mock_db, "collection", side_effect=_collection):
            resp = client.get(f"{BASE}/user/{SELF}")

        assert resp.status_code != 403
