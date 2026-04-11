#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
VERIFY_HUB_BUILD_SCRIPT="$SCRIPT_DIR/verify-hub-build.py"

echo "[COURSE-SURFACE] Ejecutando verificación base del Hub..."

if [[ ! -f "$VERIFY_HUB_BUILD_SCRIPT" ]]; then
  echo "[FAIL] verify-hub-build.py no encontrado: $VERIFY_HUB_BUILD_SCRIPT"
  exit 1
fi

if [[ "${GITHUB_ACTIONS:-}" == "true" ]]; then
  export HUB_VERIFY_SKIP_SOURCE="${HUB_VERIFY_SKIP_SOURCE:-1}"
fi

python3 "$VERIFY_HUB_BUILD_SCRIPT"

echo "[COURSE-SURFACE] Ejecutando guardas anti-regresión de superficie pública..."

HUB_ROOT="$HUB_ROOT" python3 - <<'PY'
from __future__ import annotations

import os
import re
from pathlib import Path


hub_root = Path(os.environ["HUB_ROOT"])

COURSE_FILES = {
    "ios": "stack-my-architecture-ios",
    "android": "stack-my-architecture-android",
    "sdd": "stack-my-architecture-sdd",
    "governance": "stack-my-architecture-governance",
    "pumuki": "stack-my-architecture-pumuki",
}

ASSET_VERSION_ANCHOR_COURSES = ("ios", "android", "sdd")
ASSET_VERSION_EXTENDED_COURSES = ("governance", "pumuki")

ROOT_PAGE = hub_root / "index.html"
REQUIRED_ASSETS = [
    "assets/assistant-bridge.js",
    "assets/assistant-panel.css",
    "assets/assistant-panel.js",
    "assets/course-switcher.css",
    "assets/course-switcher.js",
    "assets/study-ux.css",
    "assets/study-ux.js",
    "assets/theme-controls.js",
]

ASSET_VERSION_RE = re.compile(
    r"assets/[A-Za-z0-9._/-]+\.(?:css|js)\?v=([A-Za-z0-9._-]+)"
)

errors: list[str] = []


def anchor_versions_acceptable(versions: set[str]) -> bool:
    if len(versions) <= 1:
        return True
    if not all(v.isdigit() for v in versions):
        return False
    nums = [int(v) for v in versions]
    return max(nums) - min(nums) <= 1


def fail(message: str) -> None:
    errors.append(message)


def read_file(path: Path, label: str) -> str:
    if not path.exists():
        fail(f"{label}: archivo no encontrado -> {path}")
        return ""
    try:
        return path.read_text(encoding="utf-8")
    except Exception as exc:
        fail(f"{label}: no se pudo leer {path}: {exc}")
        return ""


def assert_locale(text: str, label: str) -> None:
    lower = text.lower()
    if "<html" not in lower:
        fail(f"{label}: no contiene etiqueta <html>")
        return
    if "lang=\"es\"" not in lower:
        fail(f"{label}: falta lang=\"es\" en la raíz html")


def assert_course_markers(text: str, label: str) -> None:
    required_markers = [
        'id="course-switcher"',
        'id="course-switcher-toggle"',
        'id="course-switcher-menu"',
        'id="course-switcher-home"',
        'id="course-switcher-ios"',
        'id="course-switcher-android"',
        'id="course-switcher-sdd"',
        'id="study-ux-controls"',
        "data-lesson-path=\"",
        'class="doc-nav-link"',
        "course-switcher.js",
        "assistant-bridge.js",
    ]
    for marker in required_markers:
        if marker not in text:
            fail(f"{label}: no contiene marcador obligatorio -> {marker}")


def collect_asset_versions_by_course() -> tuple[dict[str, dict[str, str]], dict[str, set[str]]]:
    course_asset_versions: dict[str, dict[str, str]] = {}
    shared_asset_versions: dict[str, set[str]] = {}

    for course, course_id in COURSE_FILES.items():
        page = hub_root / course / "index.html"
        text = read_file(page, f"curso {course}")
        if not text:
            continue

        marker = f'meta name="course-id" content="{course_id}"'
        if marker.lower() not in text.lower():
            fail(f"curso {course}: falta meta course-id esperado -> {course_id}")

        assert_locale(text, f"curso {course}")
        assert_course_markers(text, f"curso {course}")

        asset_versions: dict[str, str] = {}
        for match in ASSET_VERSION_RE.finditer(text):
            asset_with_version = match.group(0)
            value = match.group(1)
            asset_path = asset_with_version.split("?v=", 1)[0]
            if asset_path.startswith("./"):
                asset_path = asset_path[2:]
            if asset_path not in asset_versions:
                asset_versions[asset_path] = value
            shared_asset_versions.setdefault(asset_path, set()).add(value)

        course_asset_versions[course] = asset_versions

    return course_asset_versions, shared_asset_versions


root_html = read_file(ROOT_PAGE, "hub")
if root_html:
    assert_locale(root_html, "hub index")
    for course in (
        "./ios/index.html",
        "./android/index.html",
        "./sdd/index.html",
        "./governance/index.html",
        "./pumuki/index.html",
    ):
        if course not in root_html:
            fail(f"hub index: no contiene enlace público esperado -> {course}")

    if 'id="hub-auth-bar"' not in root_html:
        fail("hub index: falta contenedor de barra de autenticación -> id=\"hub-auth-bar\"")

course_asset_versions, _shared = collect_asset_versions_by_course()

for asset_path in REQUIRED_ASSETS:
    anchor_versions: set[str] = set()
    for course in ASSET_VERSION_ANCHOR_COURSES:
        course_versions = course_asset_versions.get(course, {})
        if asset_path not in course_versions:
            fail(f"curso {course}: no tiene asset versionado {asset_path}")
        else:
            anchor_versions.add(course_versions[asset_path])
    if not anchor_versions_acceptable(anchor_versions):
        fail(f"Versiones incoherentes (iOS/Android/SDD) en asset {asset_path}: {sorted(anchor_versions)}")
    if anchor_versions:
        label = list(anchor_versions)[0] if len(anchor_versions) == 1 else f"~{min(anchor_versions)}..{max(anchor_versions)}"
        print(f"[COURSE-SURFACE] {asset_path} ancla iOS/Android/SDD -> {label}")
    for course in ASSET_VERSION_EXTENDED_COURSES:
        course_versions = course_asset_versions.get(course, {})
        if asset_path not in course_versions:
            fail(f"curso {course}: no tiene asset versionado {asset_path}")

if errors:
    print("[FAIL] Fallos en guardas de superficie pública del Hub:")
    for error in errors:
        print(f"  - {error}")
    raise SystemExit(1)

print("[COURSE-SURFACE] Guardas anti-regresión de superficie en verde.")
