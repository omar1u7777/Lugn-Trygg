import importlib
import pkgutil
import pytest


def iter_modules(package_name):
    package = importlib.import_module(package_name)
    for _, modname, _ in pkgutil.walk_packages(package.__path__, package.__name__ + "."):
        yield modname


@pytest.mark.parametrize("module_name", list(iter_modules("Backend.src")))
def test_import_module(module_name):
    """Simply import each module to ensure there are no syntax errors."""
    importlib.import_module(module_name)
