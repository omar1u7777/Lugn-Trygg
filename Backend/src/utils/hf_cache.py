"""Helpers for normalizing Hugging Face cache environment variables."""
from __future__ import annotations

import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)

LEGACY_VARS = (
    "PYTORCH_PRETRAINED_BERT_CACHE",
    "PYTORCH_TRANSFORMERS_CACHE",
    "TRANSFORMERS_CACHE",
)


def configure_hf_cache(default_subdir: str = ".cache/huggingface") -> str:
    """Ensure ``HF_HOME`` is set and legacy cache env vars are removed.

    Returns the resolved cache path so callers can reuse it for logging/tests.
    """
    hf_home: str | None = os.getenv("HF_HOME")
    legacy_source: str | None = None

    if not hf_home:
        for legacy_var in LEGACY_VARS:
            legacy_value = os.getenv(legacy_var)
            if legacy_value:
                hf_home = legacy_value
                legacy_source = legacy_var
                break

    if not hf_home:
        default_path = Path.home() / default_subdir.replace("\\", "/")
        default_path.mkdir(parents=True, exist_ok=True)
        hf_home = str(default_path.resolve())

    os.environ["HF_HOME"] = hf_home

    for legacy_var in LEGACY_VARS:
        if legacy_var in os.environ:
            os.environ.pop(legacy_var, None)

    if legacy_source:
        logger.debug("HF_HOME set from %s -> %s", legacy_source, hf_home)
    else:
        logger.debug("HF_HOME normalized to %s", hf_home)

    return hf_home


__all__ = ["configure_hf_cache"]
