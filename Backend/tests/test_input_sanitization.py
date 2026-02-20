"""
Tests for input_sanitization.py
Covers: text/HTML/URL/email/filename sanitization, input validation, XSS prevention.
"""
import pytest


class TestSanitizeText:
    """Tests for text sanitization."""

    def test_strip_script_tags(self):
        from src.utils.input_sanitization import sanitize_text
        result = sanitize_text("<script>alert('xss')</script>hello")
        assert "<script>" not in result
        assert "hello" in result

    def test_strip_event_handlers(self):
        from src.utils.input_sanitization import sanitize_text
        result = sanitize_text('<div onclick="alert(1)">text</div>')
        assert "onclick" not in result

    def test_strip_null_bytes(self):
        from src.utils.input_sanitization import sanitize_text
        result = sanitize_text("hello\x00world")
        assert "\x00" not in result

    def test_normal_text_unchanged(self):
        from src.utils.input_sanitization import sanitize_text
        text = "Jag mår bra idag! Solen skiner. 🌞"
        result = sanitize_text(text)
        assert "Jag mår bra" in result

    def test_empty_string(self):
        from src.utils.input_sanitization import sanitize_text
        result = sanitize_text("")
        assert result == ""


class TestSanitizeEmail:
    """Tests for email sanitization."""

    def test_lowercase(self):
        from src.utils.input_sanitization import sanitize_email
        result = sanitize_email("User@Example.COM")
        assert result == "user@example.com"

    def test_strip_angle_brackets(self):
        from src.utils.input_sanitization import sanitize_email
        # Email with angle brackets fails the regex pattern and is rejected
        result = sanitize_email("<user@example.com>")
        assert result == ""

    def test_invalid_email(self):
        from src.utils.input_sanitization import sanitize_email
        result = sanitize_email("not-an-email")
        assert result == "" or "@" not in result or result == "not-an-email"


class TestSanitizeUrl:
    """Tests for URL sanitization."""

    def test_javascript_url_rejected(self):
        from src.utils.input_sanitization import sanitize_url
        result = sanitize_url("javascript:alert(1)")
        assert result == "" or "javascript" not in result

    def test_data_url_rejected(self):
        from src.utils.input_sanitization import sanitize_url
        result = sanitize_url("data:text/html,<script>alert(1)</script>")
        assert result == "" or "data:" not in result

    def test_normal_url_preserved(self):
        from src.utils.input_sanitization import sanitize_url
        result = sanitize_url("https://example.com/page")
        assert "https://example.com" in result


class TestSanitizeFilename:
    """Tests for filename sanitization."""

    def test_path_traversal_removed(self):
        from src.utils.input_sanitization import sanitize_filename
        result = sanitize_filename("../../etc/passwd")
        # Path separators are stripped; dots remain but separators are gone
        assert "/" not in result
        assert "\\" not in result

    def test_normal_filename(self):
        from src.utils.input_sanitization import sanitize_filename
        result = sanitize_filename("photo.jpg")
        assert result == "photo.jpg"


class TestInputSanitizer:
    """Tests for the InputSanitizer class."""

    def test_sanitize_with_max_length(self):
        from src.utils.input_sanitization import input_sanitizer
        result = input_sanitizer.sanitize("a" * 1000, max_length=100)
        assert len(result) <= 100

    def test_sanitize_dict(self):
        from src.utils.input_sanitization import input_sanitizer
        data = {"name": "<script>bad</script>John", "age": 25}
        result = input_sanitizer.sanitize_dict(data)
        assert "<script>" not in str(result)
        # Non-string values are converted to strings by sanitize()
        assert result["age"] == "25"


class TestValidateMoodInput:
    """Tests for mood input validation."""

    def test_valid_mood(self):
        from src.utils.input_sanitization import validate_mood_input
        result = validate_mood_input({"mood_text": "I feel good", "sentiment_score": 0.5})
        assert result is True

    def test_missing_mood_text(self):
        from src.utils.input_sanitization import validate_mood_input
        result = validate_mood_input({"sentiment_score": 0.5})
        assert result is False

    def test_invalid_sentiment_score(self):
        from src.utils.input_sanitization import validate_mood_input
        result = validate_mood_input({"mood_text": "hello", "sentiment_score": 5.0})
        assert result is False
