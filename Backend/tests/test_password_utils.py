"""
Tests for password utilities (hash, verify, validate)
"""

import pytest
from src.utils.password_utils import hash_password, verify_password, validate_password

class TestHashPassword:
    """Tests for password hashing"""
    
    def test_hash_password_success(self):
        """Test successful password hashing"""
        password = "TestPassword123!"
        hashed = hash_password(password)
        
        assert hashed is not None
        assert isinstance(hashed, str)
        assert hashed != password  # Hashed should be different
        assert len(hashed) > 0
        
    def test_hash_password_with_swedish_characters(self):
        """Test hashing password with Swedish characters"""
        password = "Lösenord123åäö!"
        hashed = hash_password(password)
        
        assert hashed is not None
        assert isinstance(hashed, str)
        
    def test_hash_password_different_each_time(self):
        """Test that same password produces different hashes (salt)"""
        password = "SamePassword123!"
        hash1 = hash_password(password)
        hash2 = hash_password(password)
        
        assert hash1 != hash2  # Different salt each time
        
    def test_hash_password_empty(self):
        """Test hashing empty password (bcrypt accepts it)"""
        hashed = hash_password("")
        assert hashed is not None
        assert isinstance(hashed, str)


class TestVerifyPassword:
    """Tests for password verification"""
    
    def test_verify_password_correct(self):
        """Test verifying correct password"""
        password = "CorrectPassword123!"
        hashed = hash_password(password)
        
        assert verify_password(password, hashed) is True
        
    def test_verify_password_incorrect(self):
        """Test verifying incorrect password"""
        password = "CorrectPassword123!"
        wrong_password = "WrongPassword123!"
        hashed = hash_password(password)
        
        assert verify_password(wrong_password, hashed) is False
        
    def test_verify_password_with_swedish_characters(self):
        """Test verifying password with Swedish characters"""
        password = "Lösenord123åäö!"
        hashed = hash_password(password)
        
        assert verify_password(password, hashed) is True
        
    def test_verify_password_invalid_hash(self):
        """Test verifying with invalid hash"""
        password = "TestPassword123!"
        invalid_hash = "not-a-valid-hash"
        
        assert verify_password(password, invalid_hash) is False
        
    def test_verify_password_empty_password(self):
        """Test verifying empty password"""
        hashed = hash_password("TestPassword123!")
        
        assert verify_password("", hashed) is False
        
    def test_verify_password_empty_hash(self):
        """Test verifying with empty hash"""
        password = "TestPassword123!"
        
        assert verify_password(password, "") is False


class TestValidatePassword:
    """Tests for password validation"""
    
    def test_validate_password_valid(self):
        """Test validating strong password"""
        assert validate_password("StrongPass123!") is True
        assert validate_password("Test1234") is True
        assert validate_password("Lösenord123") is True
        
    def test_validate_password_too_short(self):
        """Test password too short (<8 characters)"""
        assert validate_password("Short1") is False
        assert validate_password("Ab1") is False
        
    def test_validate_password_no_digit(self):
        """Test password without digit"""
        assert validate_password("NoDigitPass!") is False
        assert validate_password("OnlyLetters") is False
        
    def test_validate_password_no_uppercase(self):
        """Test password without uppercase letter"""
        assert validate_password("lowercase123!") is False
        assert validate_password("noupppercase1") is False
        
    def test_validate_password_no_lowercase(self):
        """Test password without lowercase letter"""
        assert validate_password("UPPERCASE123!") is False
        assert validate_password("ALLUPPER1") is False
        
    def test_validate_password_only_numbers(self):
        """Test password with only numbers"""
        assert validate_password("12345678") is False
        
    def test_validate_password_only_letters(self):
        """Test password with only letters"""
        assert validate_password("OnlyLetters") is False
        
    def test_validate_password_edge_case_eight_chars(self):
        """Test password exactly 8 characters"""
        assert validate_password("Test1234") is True
        
    def test_validate_password_very_long(self):
        """Test very long valid password"""
        long_password = "A" * 100 + "a" * 100 + "1" * 10
        assert validate_password(long_password) is True
        
    def test_validate_password_with_special_chars(self):
        """Test password with special characters"""
        assert validate_password("Test123!@#$") is True
        assert validate_password("Pass123_-+=") is True
        
    def test_validate_password_empty(self):
        """Test empty password"""
        assert validate_password("") is False
        
    def test_validate_password_whitespace(self):
        """Test password with whitespace"""
        assert validate_password("Test 1234") is True  # Whitespace allowed if other criteria met
        
    def test_validate_password_unicode(self):
        """Test password with unicode characters"""
        assert validate_password("Test123åäö") is True
        assert validate_password("Test123中文") is True
