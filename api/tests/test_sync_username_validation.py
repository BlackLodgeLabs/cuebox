"""Unit tests for RSS username validation."""

import pytest

from app.core.exceptions import AppError
from app.services.sync_service import SyncService


@pytest.mark.parametrize(
    "username",
    ["johndoe", "john_doe", "john-doe", "A1"],
)
def test_valid_usernames(username):
    service = SyncService(None)
    assert service.validate_username(username) == username


@pytest.mark.parametrize(
    "username",
    ["", "a" * 51, "john doe", "john@doe", "john.doe"],
)
def test_invalid_usernames(username):
    service = SyncService(None)
    with pytest.raises(AppError):
        service.validate_username(username)
