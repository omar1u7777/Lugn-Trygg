"""check-achievements judges stored activity, never the request body.

It used to take mood_count, streak, journal_count, referral_count and
meditation_count from the JSON body. Any client could POST
{"mood_count": 100} and collect the XP, and XP buys premium_time. The honest
client was wrong as well: it sent the length of one page of moods, capped at
50, so "Mood Warrior — Log 100 mood entries" could never unlock.
"""

from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from src.routes import rewards_routes as rr

NOW = datetime(2026, 10, 3, 12, 0, tzinfo=UTC)


def _iso(day, hour=9):
    return datetime(2026, 10, day, hour, 0, tzinfo=UTC).isoformat()


class TestCurrentStreak:
    def test_counts_back_from_today(self):
        assert rr._current_streak([_iso(3), _iso(2), _iso(1)], 0, now=NOW) == 3

    def test_no_entry_yet_today_does_not_break_it(self):
        assert rr._current_streak([_iso(2), _iso(1)], 0, now=NOW) == 2

    def test_a_missed_day_ends_it(self):
        assert rr._current_streak([_iso(3), _iso(1)], 0, now=NOW) == 1

    def test_several_entries_on_one_day_count_once(self):
        assert rr._current_streak([_iso(3, 8), _iso(3, 20), _iso(2)], 0, now=NOW) == 2

    def test_days_follow_the_users_clock(self):
        # 23:30 UTC on the 2nd is 01:30 on the 3rd in Stockholm (UTC+2).
        late = datetime(2026, 10, 2, 23, 30, tzinfo=UTC).isoformat()
        assert rr._current_streak([late], 0, now=NOW) == 1      # yesterday, UTC
        assert rr._current_streak([late], 120, now=NOW) == 1    # today, local
        assert rr._current_streak([late, _iso(1)], 120, now=NOW) == 1, \
            "in local time the 2nd is empty, so the 1st does not join"

    def test_naive_and_unreadable_timestamps(self):
        naive = datetime(2026, 10, 3, 9, 0).isoformat()
        assert rr._current_streak([naive, 'garbage', _iso(2)], 0, now=NOW) == 2

    def test_nothing_logged(self):
        assert rr._current_streak([], 0, now=NOW) == 0


class TestTzOffset:
    @pytest.mark.parametrize('raw,expected', [
        (120, 120), ('-300', -300), (None, 0), ('x', 0), (99999, 840), (-99999, -840),
    ])
    def test_is_bounded_and_defaults_to_utc(self, raw, expected):
        assert rr._parse_tz_offset(raw) == expected


class TestNewlyEarned:
    def test_mood_warrior_unlocks_at_one_hundred(self):
        progress = {'mood_count': 100, 'streak': 0, 'journal_count': 0,
                    'referral_count': 0, 'meditation_count': 0}
        assert 'mood_warrior' in rr._newly_earned(progress, [])
        assert 'mood_warrior' not in rr._newly_earned({**progress, 'mood_count': 99}, [])

    def test_held_achievements_are_not_awarded_again(self):
        progress = {'mood_count': 500}
        assert 'mood_warrior' not in rr._newly_earned(progress, ['mood_warrior'])


def _count_result(n):
    return [[SimpleNamespace(value=n)]]


def _progress_db(mood_count=122, journal=4, meditations=2, referrals=1, timestamps=()):
    """A Firestore double shaped like the paths _server_side_progress reads."""
    db = MagicMock()
    users = MagicMock()
    journal_col = MagicMock()
    referrals_col = MagicMock()
    db.collection.side_effect = lambda name: {
        'users': users, 'journal_entries': journal_col, 'referrals': referrals_col,
    }[name]

    user_ref = users.document.return_value
    moods = MagicMock()
    meditation = MagicMock()
    user_ref.collection.side_effect = lambda name: {
        'moods': moods, 'meditation_sessions': meditation,
    }[name]

    moods.count.return_value.get.return_value = _count_result(mood_count)
    meditation.count.return_value.get.return_value = _count_result(meditations)
    journal_col.where.return_value.count.return_value.get.return_value = _count_result(journal)

    docs = []
    for ts in timestamps:
        d = MagicMock()
        d.to_dict.return_value = {'timestamp': ts}
        docs.append(d)
    moods.order_by.return_value.limit.return_value.select.return_value.stream.return_value = iter(docs)

    ref_doc = MagicMock()
    ref_doc.exists = True
    ref_doc.to_dict.return_value = {'successful_referrals': referrals}
    referrals_col.document.return_value.get.return_value = ref_doc
    return db


class TestServerSideProgress:
    def test_counts_every_stored_mood_not_one_page(self):
        progress = rr._server_side_progress(_progress_db(mood_count=122), 'uid', 0)
        assert progress['mood_count'] == 122

    def test_reads_every_counter_from_storage(self):
        db = _progress_db(journal=4, meditations=2, referrals=1)
        progress = rr._server_side_progress(db, 'uid', 0)
        assert progress['journal_count'] == 4
        assert progress['meditation_count'] == 2
        assert progress['referral_count'] == 1

    def test_a_failed_read_is_reported_not_treated_as_zero(self):
        db = _progress_db()
        db.collection.side_effect = RuntimeError("deadline exceeded")
        with pytest.raises(rr.ProgressUnavailable):
            rr._server_side_progress(db, 'uid', 0)


@pytest.fixture
def identity_transactions(mocker):
    """Run the transactional body directly against a recording transaction."""
    mocker.patch.object(rr, 'gcfirestore', SimpleNamespace(transactional=lambda fn: fn))


def _rewards_db(stored=None):
    db = MagicMock()
    snap = MagicMock()
    snap.exists = stored is not None
    snap.to_dict.return_value = dict(stored or {})
    db.collection.return_value.document.return_value.get.return_value = snap
    return db


class TestCheckAchievementsRoute:
    URL = '/api/rewards/check-achievements'

    def test_the_request_body_cannot_award_anything(
            self, client, mocker, auth_csrf_headers, identity_transactions):
        db = _rewards_db({'xp': 0, 'achievements': [], 'badges': []})
        mocker.patch.object(rr, '_get_db', return_value=db)
        mocker.patch.object(rr, '_server_side_progress', return_value={
            'mood_count': 0, 'streak': 0, 'journal_count': 0,
            'referral_count': 0, 'meditation_count': 0})

        response = client.post(self.URL, json={
            'mood_count': 100000, 'streak': 365, 'journal_count': 999,
            'referral_count': 999, 'meditation_count': 999,
        }, headers=auth_csrf_headers)

        assert response.status_code == 200
        assert response.get_json()['data']['newAchievements'] == []
        db.transaction.return_value.update.assert_not_called()
        db.transaction.return_value.set.assert_not_called()

    def test_stored_activity_awards_xp_and_syncs_the_leaderboard(
            self, client, mocker, auth_csrf_headers, identity_transactions):
        db = _rewards_db({'xp': 40, 'achievements': ['first_mood'], 'badges': []})
        mocker.patch.object(rr, '_get_db', return_value=db)
        mocker.patch.object(rr, '_server_side_progress', return_value={
            'mood_count': 122, 'streak': 0, 'journal_count': 0,
            'referral_count': 0, 'meditation_count': 0})

        response = client.post(self.URL, json={'tz_offset_minutes': 120},
                               headers=auth_csrf_headers)

        body = response.get_json()['data']
        assert 'mood_warrior' in [a['id'] for a in body['newAchievements']]
        assert body['progress']['mood_count'] == 122
        txn = db.transaction.return_value
        update = txn.update.call_args.args[1]
        assert update['xp'] == 40 + body['totalXpEarned']
        leaderboard = txn.set.call_args
        assert leaderboard.args[1]['total_xp'] == update['xp']
        assert leaderboard.kwargs == {'merge': True}

    def test_passes_the_users_offset_to_the_streak(
            self, client, mocker, auth_csrf_headers, identity_transactions):
        mocker.patch.object(rr, '_get_db', return_value=_rewards_db({}))
        progress = mocker.patch.object(rr, '_server_side_progress', return_value={})

        client.post(self.URL, json={'tz_offset_minutes': 120}, headers=auth_csrf_headers)

        assert progress.call_args.args[2] == 120

    def test_unreadable_progress_is_a_503_not_a_zero(
            self, client, mocker, auth_csrf_headers, identity_transactions):
        db = _rewards_db({})
        mocker.patch.object(rr, '_get_db', return_value=db)
        mocker.patch.object(rr, '_server_side_progress',
                            side_effect=rr.ProgressUnavailable('deadline'))

        response = client.post(self.URL, json={}, headers=auth_csrf_headers)

        assert response.status_code == 503
        db.transaction.assert_not_called()
