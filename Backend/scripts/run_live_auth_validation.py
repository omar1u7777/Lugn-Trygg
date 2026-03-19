#!/usr/bin/env python3
"""Run formal live Firebase auth validation against staging/prod-like backend."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import requests


REQUIRED_ENV_VARS = [
    "LIVE_FIREBASE_E2E",
    "LIVE_BASE_URL",
    "LIVE_FIREBASE_EMAIL",
    "LIVE_FIREBASE_PASSWORD",
]


def _print_step(label: str, detail: str) -> None:
    print(f"[{label}] {detail}")


def _utc_now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _resolve_output_path(env_name: str, default_relative_path: str) -> Path:
    configured = os.getenv(env_name, "").strip()
    output_path = Path(configured) if configured else Path(default_relative_path)
    if output_path.is_absolute():
        output_path.parent.mkdir(parents=True, exist_ok=True)
        return output_path

    backend_root = Path(__file__).resolve().parents[1]
    absolute_path = backend_root / output_path
    absolute_path.parent.mkdir(parents=True, exist_ok=True)
    return absolute_path


def _write_report(report: dict[str, Any]) -> Path:
    report_path = _resolve_output_path(
        "LIVE_AUTH_REPORT_PATH",
        "live_tests/reports/live-auth-validation-report.json",
    )
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    _print_step("report", f"wrote validation report to {report_path}")
    return report_path


def _check_environment() -> tuple[bool, list[str]]:
    _print_step("check", "validating required environment variables")
    missing = [name for name in REQUIRED_ENV_VARS if not os.getenv(name, "").strip()]
    if missing:
        _print_step("fail", f"missing environment variables: {', '.join(missing)}")
        return False, missing

    if os.getenv("LIVE_FIREBASE_E2E", "").strip() != "1":
        _print_step("fail", "LIVE_FIREBASE_E2E must be set to 1 for explicit live execution")
        return False, ["LIVE_FIREBASE_E2E must equal 1"]

    _print_step("ok", "environment variables are set")
    return True, []


def _check_backend_reachable(base_url: str) -> tuple[bool, str]:
    _print_step("check", f"probing backend health at {base_url}")
    urls = [f"{base_url}/api/health", f"{base_url}/api/v1/health"]
    attempts = 6

    for attempt in range(1, attempts + 1):
        for url in urls:
            try:
                response = requests.get(url, timeout=10)
                if response.status_code < 500:
                    _print_step("ok", f"backend reachable via {url} (status {response.status_code})")
                    return True, url
                _print_step(
                    "retry",
                    f"health probe attempt {attempt}/{attempts} got {response.status_code} for {url}",
                )
            except requests.RequestException as exc:
                _print_step(
                    "retry",
                    f"health probe attempt {attempt}/{attempts} failed for {url}: {type(exc).__name__}",
                )

        if attempt < attempts:
            sleep_seconds = min(5 * attempt, 20)
            time.sleep(sleep_seconds)

    _print_step("fail", "backend health probe failed on both /api/health and /api/v1/health")
    return False, "unreachable"


def _new_report(base_url: str) -> dict[str, Any]:
    return {
        "timestamp_utc": _utc_now_iso(),
        "git_sha": os.getenv("GITHUB_SHA", "local"),
        "base_url": base_url,
        "status": "failed",
        "exit_code": None,
        "checks": [],
    }


def run() -> int:
    base_url = os.getenv("LIVE_BASE_URL", "").strip().rstrip("/")
    report = _new_report(base_url)

    env_ok, missing = _check_environment()
    report["checks"].append(
        {
            "name": "environment",
            "status": "pass" if env_ok else "fail",
            "details": "required variables present" if env_ok else "missing or invalid variables",
            "missing": missing,
        }
    )
    if not env_ok:
        report["exit_code"] = 2
        _write_report(report)
        return 2

    health_ok, healthy_url = _check_backend_reachable(base_url)
    report["checks"].append(
        {
            "name": "health_probe",
            "status": "pass" if health_ok else "fail",
            "details": healthy_url if health_ok else "health probe failed",
        }
    )
    if not health_ok:
        report["exit_code"] = 3
        _write_report(report)
        return 3

    backend_root = Path(__file__).resolve().parents[1]
    junit_path = _resolve_output_path(
        "LIVE_AUTH_JUNIT_PATH",
        "live_tests/reports/live-auth-validation.junit.xml",
    )
    cmd = [
        sys.executable,
        "-m",
        "pytest",
        "live_tests/test_auth_live_firebase_e2e.py",
        "-m",
        "live and e2e",
        f"--junitxml={junit_path}",
        "-q",
    ]

    _print_step("run", "executing live Firebase auth E2E verification")
    _print_step("run", "pass criteria: login works, CSRF blocks missing header, refresh rotates, logout invalidates refresh")
    result = subprocess.run(cmd, cwd=str(backend_root), check=False)

    report["checks"].append(
        {
            "name": "live_e2e_pytest",
            "status": "pass" if result.returncode == 0 else "fail",
            "details": "pytest live auth suite",
            "exit_code": result.returncode,
            "junit_xml": str(junit_path),
        }
    )
    report["status"] = "passed" if result.returncode == 0 else "failed"
    report["exit_code"] = result.returncode
    _write_report(report)

    if result.returncode == 0:
        _print_step("pass", "live auth validation passed")
        return 0

    _print_step("fail", f"live auth validation failed (pytest exit code {result.returncode})")
    return result.returncode


if __name__ == "__main__":
    raise SystemExit(run())
