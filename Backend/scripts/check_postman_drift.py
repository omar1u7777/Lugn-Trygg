#!/usr/bin/env python3
"""Detect drift between the Postman collections and the routes the app registers.

Why this exists
---------------
The repo carries 46 Postman collections across Backend/postman/ and tools/postman/,
roughly 1.2 MB of request definitions. Nothing verified they still matched the API.
An audit in August 2026 found 21 requests still pointing at the pre-`/api/v1/`
URL scheme (tidied since, though they were never broken — see
`apply_legacy_rewrite`) and two whole
blueprints (admin, predictive) with no collection at all, including
`/api/v1/admin/users/<id>/status` and `/api/v1/predictive/crisis-check`.

Collections rot silently: nothing fails when an endpoint moves, the request just
stops matching anything. This check makes that visible on every push.

What it compares
----------------
Registered routes:
  - `register_blueprint(bp, url_prefix=...)` in main.py
  - `Blueprint(..., url_prefix=...)` in the route modules themselves — peer_chat_bp
    carries its prefix this way and main.py registers it with no prefix argument
  - `MOOD_BLUEPRINTS` in mood_gateway.py — the four mood blueprints are registered
    by the gateway, not by main.py

  Miss any of those three and healthy requests look stale. All three are covered
  because the first draft of this script missed the last two and reported 41 false
  positives.

Collection requests:
  every `request.url` under Backend/postman/ and tools/postman/.

Path parameters are collapsed so `/protocols/<risk_level>`, `/protocols/{{level}}`
and `/protocols/critical` compare equal — the question is which endpoint a request
targets, not how a variable is spelled.

Usage
-----
    python scripts/check_postman_drift.py            # report, always exit 0
    python scripts/check_postman_drift.py --strict   # exit 1 if anything drifted
"""

from __future__ import annotations

import argparse
import ast
import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND = REPO_ROOT / "Backend"
MAIN_PY = BACKEND / "main.py"
ROUTES_DIR = BACKEND / "src" / "routes"
COLLECTION_DIRS = (BACKEND / "postman", REPO_ROOT / "tools" / "postman")

# Requests that deliberately target a non-existent endpoint to assert the 404
# path. They are supposed to match no route, so reporting them as drift would
# make this check permanently noisy and therefore permanently ignored.
NEGATIVE_TEST_MARKERS = (
    "nonexistent",
    "non-existent",
    "does-not-exist",
    "does_not_exist",
    "doesnotexist",
    "unknown",
    "invalid",
    "bogus",
    "not-mine",
    "fake-id",
    "%2f",  # encoded traversal probes
)


def is_negative_test(path: str) -> bool:
    lowered = path.lower()
    return any(marker in lowered for marker in NEGATIVE_TEST_MARKERS)


def legacy_rewrite_segments() -> frozenset[str]:
    """The segments main.py's LegacyAPIRewriter promotes to /api/v1/.

    Read from main.py rather than duplicated here, so the two cannot drift.
    """
    if not MAIN_PY.exists():
        return frozenset()
    src = MAIN_PY.read_text(encoding="utf-8", errors="replace")
    block = re.search(r"_V1_SEGMENTS\s*=\s*frozenset\(\[(.*?)\]\)", src, re.S)
    if not block:
        return frozenset()
    return frozenset(re.findall(r"'([^']+)'", block.group(1)))


_V1_SEGMENTS = legacy_rewrite_segments()


def apply_legacy_rewrite(path: str) -> str:
    """Model the WSGI shim that runs before Flask ever sees the request.

    main.py installs LegacyAPIRewriter, which rewrites /api/<segment>/... to
    /api/v1/<segment>/... for a fixed list of segments. So `/api/mood/log` is
    not a dead URL — it reaches the same handler as `/api/v1/mood/log`.

    Without this, the checker compared collection URLs against Flask's route
    table and called every legacy path stale. It reported 21 of them, and the
    claim that they "would 404 against any deployed version" was wrong:
    probing production, `/api/auth/login` answers 400 (the handler, rejecting
    an empty body), not 404. Versioning them explicitly is still worth doing —
    the shim is a compatibility layer, not a contract — but they were never
    broken, and a checker that cannot tell the difference will invent work.
    """
    if not path.startswith("/api/") or path.startswith("/api/v1/"):
        return path
    parts = path.split("/")
    if len(parts) >= 3 and parts[2] in _V1_SEGMENTS:
        return "/api/v1/" + "/".join(parts[2:])
    return path


def normalise(path: str) -> str:
    """Collapse every flavour of path parameter to a single '*' token."""
    path = path.split("?")[0].split("#")[0].rstrip("/")
    path = re.sub(r"\{\{[^}]+\}\}", "*", path)      # {{userId}}
    path = re.sub(r"<[^>]+>", "*", path)             # <user_id>, <int:page>
    path = re.sub(r"(?<=/):[A-Za-z_]\w*", "*", path)  # :id
    return apply_legacy_rewrite(path) or "/"


def matches(concrete: str, pattern: str) -> bool:
    """Does a collection URL hit a route pattern? '*' matches one segment."""
    c, p = concrete.split("/"), pattern.split("/")
    if len(c) != len(p):
        return False
    return all(ps == "*" or ps == cs for cs, ps in zip(c, p, strict=True))


def blueprint_prefixes() -> dict[str, str]:
    """Map blueprint variable name -> registered URL prefix."""
    prefixes: dict[str, str] = {}

    if MAIN_PY.exists():
        for line in MAIN_PY.read_text(encoding="utf-8", errors="replace").splitlines():
            m = re.search(
                r"register_blueprint\(\s*(\w+)\s*(?:,\s*url_prefix\s*=\s*['\"]([^'\"]+)['\"])?",
                line,
            )
            if m:
                prefixes[m.group(1)] = m.group(2) or ""

    # Prefix declared on the Blueprint itself rather than at registration.
    for f in ROUTES_DIR.glob("*.py"):
        src = f.read_text(encoding="utf-8", errors="replace")
        for name, prefix in re.findall(
            r"^(\w+)\s*=\s*Blueprint\([^)]*url_prefix\s*=\s*['\"]([^'\"]+)['\"]", src, re.M
        ):
            prefixes[name] = prefix

    # The mood domain is registered by mood_gateway.register_mood_gateway(app).
    gateway = ROUTES_DIR / "mood_gateway.py"
    if gateway.exists():
        body = gateway.read_text(encoding="utf-8", errors="replace")
        block = re.search(r"MOOD_BLUEPRINTS[^=]*=\s*\((.*?)\)\s*$", body, re.S | re.M)
        if block:
            for name, prefix in re.findall(
                r"\(\s*(\w+)\s*,\s*['\"]([^'\"]+)['\"]\s*\)", block.group(1)
            ):
                prefixes[name] = prefix

    return prefixes


def registered_routes() -> dict[str, set[str]]:
    """{normalised path -> {HTTP methods}} for every route the app serves.

    Parsed with `ast`, not regex. A regex over the source text cannot tell code
    from a string literal, and integration_routes.py keeps a deprecated
    `@integration_bp.route("/wearable/connect")` handler inside a triple-quoted
    block — commented out on purpose, never registered by Flask. The regex
    version counted it as a live route and then reported it as an endpoint with
    no collection, sending someone off to write tests for something that does
    not exist. The AST sees only real decorators.
    """
    prefixes = blueprint_prefixes()
    routes: dict[str, set[str]] = {}

    for f in sorted(ROUTES_DIR.glob("*.py")):
        try:
            tree = ast.parse(f.read_text(encoding="utf-8", errors="replace"))
        except SyntaxError as exc:
            print(f"  !! could not parse {f.name}: {exc}")
            continue

        for node in ast.walk(tree):
            if not isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef):
                continue
            for dec in node.decorator_list:
                if not (isinstance(dec, ast.Call)
                        and isinstance(dec.func, ast.Attribute)
                        and dec.func.attr == "route"
                        and isinstance(dec.func.value, ast.Name)):
                    continue

                prefix = prefixes.get(dec.func.value.id)
                if prefix is None:
                    continue  # blueprint declared but never registered

                if not dec.args:
                    continue
                try:
                    # A blueprint root is registered as @bp.route(''), an EMPTY
                    # rule. An earlier regex required one or more characters and
                    # silently dropped all five of them.
                    rule = ast.literal_eval(dec.args[0])
                except ValueError:
                    continue
                if not isinstance(rule, str):
                    continue

                methods = ["GET"]
                for kw in dec.keywords:
                    if kw.arg == "methods":
                        try:
                            value = ast.literal_eval(kw.value)
                        except ValueError:
                            continue
                        if isinstance(value, list | tuple) and value:
                            methods = [str(m) for m in value]

                routes.setdefault(normalise(prefix + rule), set()).update(
                    m.upper() for m in methods
                )
    return routes


def collection_requests() -> tuple[dict[str, set[str]], list[str]]:
    """({normalised path -> {methods}}, [parse errors])."""
    found: dict[str, set[str]] = {}
    errors: list[str] = []

    def walk(node) -> None:
        if isinstance(node, dict):
            req = node.get("request")
            if isinstance(req, dict):
                url = req.get("url")
                raw = url.get("raw") if isinstance(url, dict) else url
                if isinstance(raw, str):
                    m = re.search(r"/api/[^\s\"']*", raw)
                    if m:
                        found.setdefault(normalise(m.group(0)), set()).add(
                            str(req.get("method", "GET")).upper()
                        )
            for v in node.values():
                walk(v)
        elif isinstance(node, list):
            for v in node:
                walk(v)

    for directory in COLLECTION_DIRS:
        if not directory.exists():
            continue
        for f in sorted(directory.rglob("*.json")):
            try:
                walk(json.loads(f.read_text(encoding="utf-8", errors="replace")))
            except Exception as exc:
                # A collection that no longer parses is drift of the worst kind.
                errors.append(f"{f.relative_to(REPO_ROOT)}: {exc}")
    return found, errors


def analyse() -> dict:
    routes = registered_routes()
    coll, parse_errors = collection_requests()

    route_keys = list(routes)
    stale = sorted(
        p
        for p in coll
        if not is_negative_test(p) and not any(matches(p, r) for r in route_keys)
    )
    uncovered = sorted(r for r in routes if not any(matches(c, r) for c in coll))

    return {
        "routes": routes,
        "collection": coll,
        "stale": stale,
        "uncovered": uncovered,
        "parse_errors": parse_errors,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--strict",
        action="store_true",
        help="exit 1 when a collection request matches no route",
    )
    args = parser.parse_args()

    result = analyse()
    routes, coll = result["routes"], result["collection"]
    stale, uncovered = result["stale"], result["uncovered"]

    print(f"Registered routes  : {len(routes)}")
    print(f"Collection requests: {len(coll)}")
    print()

    for err in result["parse_errors"]:
        print(f"UNPARSEABLE COLLECTION: {err}")
    if result["parse_errors"]:
        print()

    print(f"STALE — request targets no registered route ({len(stale)}):")
    for p in stale:
        print(f"  {','.join(sorted(coll[p])):20} {p}")
    if not stale:
        print("  (none)")
    print()

    print(f"UNCOVERED — route with no collection request ({len(uncovered)}):")
    for p in uncovered:
        print(f"  {','.join(sorted(routes[p])):20} {p}")
    if not uncovered:
        print("  (none)")
    print()

    covered = len(routes) - len(uncovered)
    pct = (covered / len(routes) * 100) if routes else 0.0
    print(f"Coverage: {covered}/{len(routes)} routes ({pct:.0f}%)")

    if args.strict and (stale or result["parse_errors"]):
        print("\nFAILED: collections have drifted from the API.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
