"""Erasing an account removes its voice recordings too.

purge_user_data deleted every Firestore collection that holds a person's data
and left their files in the storage bucket: the recordings under
users/{uid}/voice/ outlived the account they belonged to. The files now go
first, before any document, so a failure leaves the account whole and queued
for the next run instead of half erased with nothing left to find it by.
"""

from unittest.mock import MagicMock, Mock, patch

import pytest

from src.routes import privacy_routes as pr

USER_ID = 'user-abcdef123456'


def _storage(*names):
    blobs = [Mock(name=name) for name in names]
    storage = MagicMock()
    storage.bucket.return_value.list_blobs.return_value = blobs
    return storage, blobs


def test_every_file_under_the_users_folder_is_deleted():
    storage, blobs = _storage('users/u/voice/a.webm', 'users/u/voice/b.webm')

    with patch.object(pr, 'firebase_storage', storage):
        assert pr.delete_user_files(USER_ID) == 2

    storage.bucket.return_value.list_blobs.assert_called_once_with(prefix=f'users/{USER_ID}/')
    for blob in blobs:
        blob.delete.assert_called_once_with()


def test_the_folder_is_matched_whole_so_another_users_files_are_not_touched():
    storage, _ = _storage()

    with patch.object(pr, 'firebase_storage', storage):
        pr.delete_user_files('user-1')

    # 'users/user-1' without the slash would also match users/user-10/...
    assert storage.bucket.return_value.list_blobs.call_args.kwargs['prefix'].endswith('/')


def test_without_storage_there_is_nothing_to_delete():
    with patch.object(pr, 'firebase_storage', None):
        assert pr.delete_user_files(USER_ID) == 0


def test_a_purge_deletes_the_files_before_any_document():
    db = MagicMock()
    db.collection.side_effect = AssertionError('a document was touched before the files were gone')

    with patch.object(pr, 'db', db), patch.object(pr, 'delete_user_files', side_effect=RuntimeError('bucket down')):
        with pytest.raises(RuntimeError, match='bucket down'):
            pr.purge_user_data(USER_ID)
