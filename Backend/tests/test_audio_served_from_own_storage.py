"""The sound library can be served from our own storage.

Every track's address pointed at upload.wikimedia.org. That is someone else's
server with no agreement behind it: it rate-limits (a 429 has been seen) and a
file renamed there is a dead track here. Setting AUDIO_BASE_URL to where the
same files have been copied serves every track from there, by file name, with
no code change. Unset, the addresses are as before.
"""

import pytest

from src.routes.audio_routes import AUDIO_LIBRARY, served_url

LIBRARY_URL = '/api/v1/audio/library'
OWN = 'https://res.cloudinary.com/example/video/upload/lugn-trygg'
SOURCES = sorted({track['url'] for category in AUDIO_LIBRARY.values() for track in category['tracks']})


def _served(client):
    library = client.get(LIBRARY_URL).get_json()['data']['library']
    return [track['url'] for category in library.values() for track in category['tracks']]


def test_without_own_storage_the_addresses_are_unchanged(client, monkeypatch):
    monkeypatch.delenv('AUDIO_BASE_URL', raising=False)

    assert sorted(set(_served(client))) == SOURCES


def test_with_own_storage_every_track_is_served_from_it(client, monkeypatch):
    monkeypatch.setenv('AUDIO_BASE_URL', OWN)

    urls = _served(client)

    assert urls
    assert all(url.startswith(OWN + '/') for url in urls), urls
    assert not any('wikimedia' in url for url in urls)


@pytest.mark.parametrize('base', [OWN, OWN + '/'])
def test_a_track_keeps_its_file_name(monkeypatch, base):
    monkeypatch.setenv('AUDIO_BASE_URL', base)

    assert served_url('https://upload.wikimedia.org/wikipedia/commons/8/8a/Sound_of_rain.ogg') \
        == OWN + '/Sound_of_rain.ogg'
    assert served_url('https://upload.wikimedia.org/wikipedia/commons/a/a7/Chopin%2C_Nocturne_op_32_no_1.ogg') \
        == OWN + '/Chopin%2C_Nocturne_op_32_no_1.ogg'


@pytest.mark.parametrize('base', ['', '   ', 'http://insecure.example/audio', 'ftp://x', 'not a url'])
def test_a_base_that_is_not_an_https_address_is_ignored(monkeypatch, base):
    monkeypatch.setenv('AUDIO_BASE_URL', base)
    source = 'https://upload.wikimedia.org/wikipedia/commons/8/8a/Sound_of_rain.ogg'

    assert served_url(source) == source


def test_one_track_and_one_category_are_served_from_it_too(client, monkeypatch):
    monkeypatch.setenv('AUDIO_BASE_URL', OWN)
    category_id, category = next(iter(AUDIO_LIBRARY.items()))
    track_id = category['tracks'][0]['id']

    by_category = client.get(f'/api/v1/audio/category/{category_id}').get_json()['data']
    by_track = client.get(f'/api/v1/audio/track/{track_id}').get_json()['data']

    assert OWN in str(by_category) and 'wikimedia' not in str(by_category)
    assert OWN in str(by_track) and 'wikimedia' not in str(by_track)


def test_no_two_files_share_a_name():
    # The files are copied flat, so two sources with one name would collide.
    names = [url.rsplit('/', 1)[-1] for url in SOURCES]

    assert len(names) == len(set(names))
