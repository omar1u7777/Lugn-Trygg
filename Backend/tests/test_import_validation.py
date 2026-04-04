"""
Full import chain validation — no Firebase or external connections needed.
"""
import sys
sys.path.insert(0, '.')

from unittest.mock import patch, MagicMock

mock_modules = {
    'firebase_admin': MagicMock(),
    'firebase_admin.credentials': MagicMock(),
    'firebase_admin.firestore': MagicMock(),
    'firebase_admin.storage': MagicMock(),
    'firebase_admin.auth': MagicMock(),
    'google.cloud.firestore': MagicMock(),
    'redis': MagicMock(),
}

with patch.dict('sys.modules', mock_modules):
    import src.firebase_config as fc
    fc.db = MagicMock()

    from src.routes.mood_routes import mood_bp
    from src.routes.mood_stats_routes import mood_stats_bp

    print('mood_bp name:', mood_bp.name)
    print('mood_stats_bp name:', mood_stats_bp.name)
    print('mood_stats_bp deferred functions:', len(mood_stats_bp.deferred_functions))

    # Verify new endpoints are registered
    func_names = [f.__name__ if hasattr(f, '__name__') else str(f) for f in mood_stats_bp.deferred_functions]
    print('Deferred functions:', func_names)
    print('All blueprint imports OK!')

print()
print('Python syntax compile checks:')
import py_compile
for path in [
    'src/routes/mood_routes.py',
    'src/routes/mood_stats_routes.py',
]:
    try:
        py_compile.compile(path, doraise=True)
        print(f'  OK: {path}')
    except py_compile.PyCompileError as e:
        print(f'  FAIL: {path} — {e}')
