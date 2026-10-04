"""Other users are shown by a stable pseudonym, never by name or email.

The referral leaderboard was public and returned real names and user ids; the
XP, streak and mood boards showed masked emails ("om***7"), which link back to
the address the person uses everywhere else.
"""

from unittest.mock import MagicMock

from src.utils.public_alias import public_alias


class TestPublicAlias:
    def test_is_stable_per_user(self):
        assert public_alias('uid-123') == public_alias('uid-123')

    def test_differs_between_users(self):
        aliases = {public_alias(f'user-{i}') for i in range(200)}
        assert len(aliases) > 190, "collisions should be rare"

    def test_contains_nothing_from_the_id(self):
        alias = public_alias('omaralhaek97')
        assert 'omar' not in alias.lower()
        assert alias[-3:].isdigit()

    def test_depends_on_the_server_secret(self, monkeypatch):
        monkeypatch.setenv('JWT_SECRET_KEY', 'one')
        first = public_alias('uid')
        monkeypatch.setenv('JWT_SECRET_KEY', 'two')
        assert public_alias('uid') != first, "must not be computable without the secret"

    def test_missing_id(self):
        assert public_alias('') == 'Anonym'


def _doc(doc_id, data):
    d = MagicMock()
    d.id = doc_id
    d.to_dict.return_value = data
    return d


class TestReferralLeaderboard:
    URL = '/api/v1/referral/leaderboard'

    def test_requires_a_signed_in_user(self):
        # conftest replaces jwt_required for every test, so a 401 cannot be
        # observed through the client; check the route is declared with it.
        import inspect
        import re

        from src.routes import referral_routes
        source = inspect.getsource(referral_routes)
        declaration = re.search(
            r'@referral_bp\.route\("/leaderboard".*?\ndef get_leaderboard', source, re.S).group(0)
        assert '@AuthService.jwt_required' in declaration

    def test_shows_aliases_not_names_or_ids(self, client, auth_headers, mock_auth_service, mocker):
        db = mocker.patch('src.routes.referral_routes.db')
        query = db.collection.return_value.where.return_value.order_by.return_value.limit.return_value
        query.get.return_value = [_doc('uid-a', {'user_id': 'uid-a', 'successful_referrals': 6})]

        response = client.get(self.URL, headers=auth_headers)

        assert response.status_code == 200
        entry = response.get_json()['data']['leaderboard'][0]
        assert entry['name'] == public_alias('uid-a')
        assert 'userId' not in entry
        assert entry['tier'] == 'Silver'
        db.collection.return_value.document.assert_not_called(), "no per-user reads"

    def test_only_people_who_referred_someone_are_listed(self, client, auth_headers, mock_auth_service, mocker):
        db = mocker.patch('src.routes.referral_routes.db')
        query = db.collection.return_value.where.return_value.order_by.return_value.limit.return_value
        query.get.return_value = []

        client.get(self.URL, headers=auth_headers)

        field_filter = db.collection.return_value.where.call_args.kwargs['filter']
        assert (field_filter.field_path, field_filter.op_string, field_filter.value) == \
            ('successful_referrals', '>', 0)
