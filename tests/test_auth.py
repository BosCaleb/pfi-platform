"""
Unit tests for app/auth.py — password hashing and JWT utilities.

Password hashing tests mock the passlib context so they are independent
of the installed bcrypt backend version.

JWT tests exercise the real jose implementation without any mocking.
"""

import time
from datetime import timedelta
from unittest.mock import MagicMock, patch

import pytest
from jose import jwt

from app.auth import (
    ALGORITHM,
    SECRET_KEY,
    create_access_token,
    get_password_hash,
    verify_password,
)


# ================================================================== #
# Password hashing                                                     #
# ================================================================== #


class TestPasswordHashing:
    """Tests for get_password_hash and verify_password.

    Passlib/bcrypt are mocked so these tests run regardless of the
    bcrypt version installed in the current Python environment.
    The integration between passlib and bcrypt is tested by the
    Docker image build, which always uses the pinned requirements.txt.
    """

    def test_hash_delegates_to_pwd_context(self):
        """get_password_hash should call pwd_context.hash and return its result."""
        with patch("app.auth.pwd_context") as mock_ctx:
            mock_ctx.hash.return_value = "$2b$12$fakehash"
            result = get_password_hash("mysecret")
            mock_ctx.hash.assert_called_once_with("mysecret")
            assert result == "$2b$12$fakehash"

    def test_verify_correct_password_returns_true(self):
        """verify_password should return True when pwd_context.verify returns True."""
        with patch("app.auth.pwd_context") as mock_ctx:
            mock_ctx.verify.return_value = True
            assert verify_password("correct", "$2b$12$fakehash") is True
            mock_ctx.verify.assert_called_once_with("correct", "$2b$12$fakehash")

    def test_verify_wrong_password_returns_false(self):
        """verify_password should return False when pwd_context.verify returns False."""
        with patch("app.auth.pwd_context") as mock_ctx:
            mock_ctx.verify.return_value = False
            assert verify_password("wrong", "$2b$12$fakehash") is False

    def test_hash_is_not_plaintext(self):
        """Ensure the returned hash is never the raw plaintext."""
        with patch("app.auth.pwd_context") as mock_ctx:
            mock_ctx.hash.return_value = "$2b$12$somebcrypthash"
            hashed = get_password_hash("plaintext")
            assert hashed != "plaintext"

    def test_verify_calls_both_arguments(self):
        """Both the plain and hashed passwords must be forwarded to the context."""
        with patch("app.auth.pwd_context") as mock_ctx:
            mock_ctx.verify.return_value = True
            verify_password("plain", "hashed")
            mock_ctx.verify.assert_called_once_with("plain", "hashed")


# ================================================================== #
# JWT creation                                                         #
# ================================================================== #


class TestCreateAccessToken:
    def test_token_contains_subject(self):
        token = create_access_token({"sub": "42"})
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert payload["sub"] == "42"

    def test_token_contains_expiry(self):
        token = create_access_token({"sub": "1"})
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert "exp" in payload

    def test_custom_expiry_is_respected(self):
        token = create_access_token({"sub": "1"}, expires_delta=timedelta(minutes=1))
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        remaining = payload["exp"] - int(time.time())
        # Allow ±5 s for test execution latency.
        assert 55 <= remaining <= 65

    def test_expired_token_raises(self):
        from jose import ExpiredSignatureError

        token = create_access_token({"sub": "1"}, expires_delta=timedelta(seconds=-1))
        with pytest.raises(ExpiredSignatureError):
            jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

    def test_tampered_token_raises(self):
        from jose import JWTError

        token = create_access_token({"sub": "1"}) + "tampered"
        with pytest.raises(JWTError):
            jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

    def test_wrong_key_raises(self):
        from jose import JWTError

        token = create_access_token({"sub": "1"})
        with pytest.raises(JWTError):
            jwt.decode(token, "wrong-key", algorithms=[ALGORITHM])

    def test_additional_claims_are_preserved(self):
        token = create_access_token({"sub": "5", "role": "admin"})
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert payload["role"] == "admin"
