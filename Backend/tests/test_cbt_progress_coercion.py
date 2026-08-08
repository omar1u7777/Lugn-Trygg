"""CBT progress must survive null/garbage numeric fields from the client.

dict.get(key, default) only supplies the default when the key is ABSENT, so a
client sending an explicit JSON null produced int(None) and a 500 --
"int() argument must be a string, a bytes-like object or a real number, not
'NoneType'" -- which is how update_progress was failing in production.
"""

from src.routes.cbt_routes import _coerce_number


class TestCoerceNumber:
    def test_explicit_none_falls_back_to_default(self):
        # The actual production failure: {"timeSpent": null}
        assert _coerce_number(None, 0, int) == 0
        assert _coerce_number(None, 0.5, float) == 0.5

    def test_valid_values_are_cast(self):
        assert _coerce_number("42", 0, int) == 42
        assert _coerce_number(7, 0, int) == 7
        assert _coerce_number("0.75", 0.5, float) == 0.75

    def test_non_numeric_string_falls_back_rather_than_raising(self):
        assert _coerce_number("abc", 3, int) == 3
        assert _coerce_number("", 0, int) == 0

    def test_wrong_type_falls_back_rather_than_raising(self):
        assert _coerce_number({"a": 1}, 0, int) == 0
        assert _coerce_number(["x"], 0.5, float) == 0.5

    def test_float_string_to_int_falls_back_instead_of_crashing(self):
        # int("1.5") raises ValueError; must not escape as a 500.
        assert _coerce_number("1.5", 0, int) == 0
