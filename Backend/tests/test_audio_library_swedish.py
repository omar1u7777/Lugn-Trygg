"""The sound library's track credits are Swedish, like its titles.

Titles and descriptions were Swedish, but the line under each title, which the
player shows as the artist, was an English label: "Nature Sounds", "Sleep
Music", "Focus Music". Only real names stay as they are.
"""

from src.routes.audio_routes import AUDIO_LIBRARY

ENGLISH = ('Sounds', 'Music', 'Audio', 'Focus', 'Healing', 'Generator')


def test_no_track_is_credited_with_an_english_label():
    credits = {track['artist'] for category in AUDIO_LIBRARY.values() for track in category['tracks']}

    assert credits
    assert sorted(c for c in credits if any(word in c for word in ENGLISH)) == []
