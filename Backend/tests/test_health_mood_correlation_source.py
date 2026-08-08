"""analyze_health_mood_correlation must read the moods users actually write.

It previously queried a top-level 'moods' collection filtered on 'created_at'
-- the schema of MoodRepository, a class no route or service imports. That
collection is never written by the live logging path (which writes to
users/{uid}/moods keyed on 'timestamp'), so the function could only ever fall
through to "Not enough data" and the correlation never produced a real result.
"""

from unittest.mock import MagicMock, patch


def _mood(score):
    doc = MagicMock()
    doc.to_dict.return_value = {"score": score, "timestamp": "2026-08-01T10:00:00+00:00"}
    return doc


class TestHealthMoodCorrelationSource:
    def test_reads_the_user_moods_subcollection_not_a_top_level_collection(self):
        from src.routes import integration_routes

        with patch.object(integration_routes, "db") as mock_db:
            stream = [_mood(7)] * 10
            (mock_db.collection.return_value.document.return_value
                .collection.return_value
                .where.return_value.order_by.return_value.limit.return_value
                .stream.return_value) = stream

            result = integration_routes.analyze_health_mood_correlation(
                "user-1", {"sleepHours": 8, "steps": 12000, "heartRate": 60}
            )

        # Scoped through users/<uid>/moods, not a bare top-level collection.
        mock_db.collection.assert_any_call("users")
        mock_db.collection.return_value.document.assert_any_call("user-1")
        mock_db.collection.return_value.document.return_value.collection.assert_any_call("moods")

        # With 10 real mood points it must produce actual correlations rather
        # than the "not enough data" fallback.
        assert result["data_points"] == 10
        assert result["sleepMoodCorrelation"] is not None

    def test_still_reports_insufficient_data_when_there_are_few_moods(self):
        from src.routes import integration_routes

        with patch.object(integration_routes, "db") as mock_db:
            (mock_db.collection.return_value.document.return_value
                .collection.return_value
                .where.return_value.order_by.return_value.limit.return_value
                .stream.return_value) = [_mood(5)]

            result = integration_routes.analyze_health_mood_correlation(
                "user-1", {"sleepHours": 8}
            )

        assert result["sleepMoodCorrelation"] is None
        assert "Not enough data" in result["insights"][0]
