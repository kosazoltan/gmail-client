#!/usr/bin/env python3
"""
Production deploy smoke + tartalmi ellenőrzés (GitHub Actions: Deploy healthcheck).

Környezet:
  ZMAIL_API_BASE          — pl. https://api.mindenes.org (API host, path nélkül)
  ZMAIL_API_HEALTH_URL    — opcionális; ha megvan, health erre megy; BASE ebből is kiderülhet
  ZMAIL_FRONTEND_URL      — pl. https://mail.mindenes.org/ (végén / opcionális)
  VERIFY_INITIAL_SLEEP_S  — első health próba előtti várakozás másodpercben (alap: 45)
  VERIFY_API_RETRIES      — health újrapróbák száma (alap: 15)
  VERIFY_API_RETRY_DELAY  — másodperc két health próba között (alap: 25)
  VERIFY_SKIP_INITIAL_SLEEP — ha "1", nem vár az elején (kézi futtatáshoz)
"""
from __future__ import annotations

import http.cookiejar
import json
import os
import sys
import time
import urllib.error
import urllib.request
from typing import Any


def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def resolve_api_endpoints() -> tuple[str, str]:
    """Vissza: (api_base, health_url)."""
    health = os.environ.get("ZMAIL_API_HEALTH_URL", "").strip()
    base = os.environ.get("ZMAIL_API_BASE", "").strip().rstrip("/")
    if health:
        h = health.rstrip("/")
        if h.endswith("/api/health") and not base:
            base = h[: -len("/api/health")]
        if not base:
            # pl. teljes URL más path-szel — ne találgassunk, health marad abszolút
            base = ""
    if not health and base:
        health = f"{base}/api/health"
    if not health:
        base = base or "https://api.mindenes.org"
        health = f"{base}/api/health"
    if not base:
        # health abszolút URL, base csak auth/login-hoz kell
        if "/api/health" in health:
            base = health.split("/api/health")[0].rstrip("/")
        else:
            base = "https://api.mindenes.org"
    return base.rstrip("/"), health


def http_get(
    url: str,
    *,
    opener: urllib.request.OpenerDirector | None = None,
) -> tuple[int, bytes]:
    op = opener or urllib.request.build_opener()
    req = urllib.request.Request(url, method="GET")
    try:
        with op.open(req, timeout=35) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read() if e.fp else b""


def parse_json_body(code: int, raw: bytes) -> Any:
    text = raw.decode("utf-8", errors="replace")
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        raise SystemExit(f"HTTP {code}: nem JSON válasz: {text[:200]!r} ({e})") from e


def check_health(health_url: str) -> None:
    code, raw = http_get(health_url)
    data = parse_json_body(code, raw)
    if code != 200:
        raise SystemExit(f"Health HTTP {code}: {data!r}")
    if data.get("status") != "ok":
        raise SystemExit(f"Health status nem ok: {data!r}")
    if data.get("database") != "connected":
        raise SystemExit(f"Health database nem connected: {data!r}")
    if not isinstance(data.get("timestamp"), int):
        raise SystemExit(f"Health hiányzó timestamp: {data!r}")
    print("OK: /api/health — status=ok, database=connected")


def check_auth_login(api_base: str) -> None:
    url = f"{api_base}/api/auth/login"
    jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    code, raw = http_get(url, opener=opener)
    data = parse_json_body(code, raw)
    if code != 200:
        raise SystemExit(f"Auth login HTTP {code}: {data!r}")
    auth_url = data.get("url")
    if not isinstance(auth_url, str) or not auth_url.strip():
        raise SystemExit(f"Auth login: hiányzó vagy üres 'url' mező: {data!r}")
    lowered = auth_url.lower()
    if "google" not in lowered and "oauth" not in lowered:
        raise SystemExit(f"Auth login: url nem tűnik OAuth URL-nek: {auth_url[:120]!r}")
    print("OK: /api/auth/login — OAuth URL a válaszban")


def check_frontend_index(front_base: str) -> None:
    base = front_base.rstrip("/") + "/"
    code, raw = http_get(base)
    text = raw.decode("utf-8", errors="replace")
    if code != 200:
        raise SystemExit(f"Frontend index HTTP {code}")
    if 'id="root"' not in text and "id='root'" not in text:
        raise SystemExit("Frontend index: hiányzik a #root mount (id=\"root\")")
    if "/assets/" not in text and "ZMail" not in text:
        raise SystemExit("Frontend index: nincs /assets/ és nincs 'ZMail' — nem tűnik prod buildnek")
    print("OK: frontend / — #root + prod jelző (/assets/ vagy ZMail)")


def check_frontend_manifest(front_base: str) -> None:
    base = front_base.rstrip("/")
    url = f"{base}/manifest.json"
    code, raw = http_get(url)
    data = parse_json_body(code, raw)
    if code != 200:
        raise SystemExit(f"manifest.json HTTP {code}: {data!r}")
    short_name = data.get("short_name") or ""
    name = data.get("name") or ""
    if "ZMail" not in str(short_name) and "ZMail" not in str(name):
        raise SystemExit(f"manifest.json: short_name/name nem tartalmazza a ZMail-t: {data!r}")
    print("OK: /manifest.json — ZMail azonosító")


def main() -> None:
    api_base, health_url = resolve_api_endpoints()
    front = os.environ.get("ZMAIL_FRONTEND_URL", "https://mail.mindenes.org/").strip() or (
        "https://mail.mindenes.org/"
    )

    initial = _env_int("VERIFY_INITIAL_SLEEP_S", 45)
    if os.environ.get("VERIFY_SKIP_INITIAL_SLEEP", "").strip() == "1":
        initial = 0
    retries = max(1, _env_int("VERIFY_API_RETRIES", 15))
    delay = max(1, _env_int("VERIFY_API_RETRY_DELAY", 25))

    print(f"API base: {api_base}")
    print(f"Health URL: {health_url}")
    print(f"Frontend: {front}")

    if initial:
        print(f"Várakozás {initial}s (deploy késleltetés)...")
        time.sleep(initial)

    last_err: str | None = None
    for attempt in range(1, retries + 1):
        try:
            check_health(health_url)
            last_err = None
            break
        except SystemExit as e:
            last_err = str(e)
            print(f"Health próba {attempt}/{retries} sikertelen: {last_err}")
            if attempt < retries:
                print(f"Újrapróba {delay}s múlva...")
                time.sleep(delay)
    if last_err:
        print(f"::error::{last_err}", file=sys.stderr)
        raise SystemExit(1)

    check_auth_login(api_base)
    check_frontend_index(front)
    check_frontend_manifest(front)
    print("Minden tartalmi ellenőrzés rendben.")


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as e:
        print(f"::error::verify-production váratlan hiba: {e}", file=sys.stderr)
        raise SystemExit(1) from e
