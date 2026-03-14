#!/usr/bin/env python3
"""Smoke test del contenido publicado en el hub."""

from __future__ import annotations

import hashlib
from pathlib import Path
import re
import sys

HUB_ROOT = Path(__file__).resolve().parent.parent
PROJECTS_ROOT = HUB_ROOT.parent

REQUIRED_FILES = [
    "index.html",
    "ios/index.html",
    "ios/curso-stack-my-architecture.html",
    "android/index.html",
    "android/curso-stack-my-architecture-android.html",
    "sdd/index.html",
    "sdd/curso-stack-my-architecture-sdd.html",
]

REQUIRED_SHARED_ASSETS = [
    "assets/assistant-bridge.js",
    "assets/assistant-panel.css",
    "assets/assistant-panel.js",
    "assets/course-switcher.css",
    "assets/course-switcher.js",
    "assets/study-ux.css",
    "assets/study-ux.js",
    "assets/theme-controls.js",
]

COURSE_META = {
    "ios/index.html": "stack-my-architecture-ios",
    "android/index.html": "stack-my-architecture-android",
    "sdd/index.html": "stack-my-architecture-sdd",
}

COURSE_HTMLS = {
    "ios": "curso-stack-my-architecture.html",
    "android": "curso-stack-my-architecture-android.html",
    "sdd": "curso-stack-my-architecture-sdd.html",
}

SOURCE_REPOS = {
    "ios": PROJECTS_ROOT / "stack-my-architecture-ios",
    "android": PROJECTS_ROOT / "stack-my-architecture-android",
    "sdd": PROJECTS_ROOT / "stack-my-architecture-SDD",
}

ASSET_VERSION_RE = re.compile(
    r"(assets/[A-Za-z0-9._/-]+\.(?:css|js)\?v=)([A-Za-z0-9._-]+)"
)


def source_dist_dir(course: str) -> Path:
    repo = SOURCE_REPOS[course]
    primary = repo / "dist"
    nested = repo / "stack-my-architecture-SDD" / "dist"
    if course == "sdd" and nested.exists():
        return nested
    return primary


def read_text(rel_path: str) -> str:
    return (HUB_ROOT / rel_path).read_text(encoding="utf-8")


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        while True:
            chunk = f.read(1024 * 1024)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def sha256_normalized_html(path: Path) -> str:
    """Hash HTML while ignoring asset cache-busting version values."""
    text = path.read_text(encoding="utf-8")
    normalized = ASSET_VERSION_RE.sub(r"\1<STAMP>", text)
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def main() -> int:
    errors: list[str] = []

    for rel_path in REQUIRED_FILES:
        path = HUB_ROOT / rel_path
        if not path.exists():
            errors.append(f"Missing required file: {rel_path}")
            continue
        if path.stat().st_size < 256:
            errors.append(f"File too small / suspicious: {rel_path}")

    for course in ("ios", "android", "sdd"):
        for rel_asset in REQUIRED_SHARED_ASSETS:
            rel_path = f"{course}/{rel_asset}"
            if not (HUB_ROOT / rel_path).exists():
                errors.append(f"Missing required asset: {rel_path}")

    # Integridad de copia: el artefacto publicado debe coincidir con su fuente en dist.
    for course, html_name in COURSE_HTMLS.items():
        src_html = source_dist_dir(course) / html_name
        dst_html = HUB_ROOT / course / html_name
        course_index = HUB_ROOT / course / "index.html"

        if not src_html.exists():
            errors.append(f"Missing source dist HTML: {src_html}")
            continue
        if not dst_html.exists():
            errors.append(f"Missing published course HTML: {dst_html}")
            continue

        src_hash = sha256_normalized_html(src_html)
        dst_hash = sha256_normalized_html(dst_html)
        if src_hash != dst_hash:
            errors.append(
                f"Published HTML hash mismatch for {course}: source={src_hash[:12]} dest={dst_hash[:12]}"
            )

        # En este hub index.html de cada curso debe ser copia exacta del HTML principal.
        if course_index.exists():
            index_hash = sha256_normalized_html(course_index)
            if index_hash != dst_hash:
                errors.append(
                    f"Course index is not aligned with published HTML for {course}: index={index_hash[:12]} html={dst_hash[:12]}"
                )
        else:
            errors.append(f"Missing course index file: {course_index}")

    try:
        root_index = read_text("index.html")
        for href in ("./ios/index.html", "./android/index.html", "./sdd/index.html"):
            if href not in root_index:
                errors.append(f"Root index missing course link: {href}")
    except Exception as exc:  # pragma: no cover - defensive
        errors.append(f"Cannot read root index: {exc}")

    for rel_path, course_id in COURSE_META.items():
        try:
            content = read_text(rel_path)
        except Exception as exc:  # pragma: no cover - defensive
            errors.append(f"Cannot read {rel_path}: {exc}")
            continue

        lower = content.lower()
        if "<!doctype html>" not in lower:
            errors.append(f"{rel_path} missing HTML doctype")
        if f'meta name="course-id" content="{course_id}"' not in lower:
            errors.append(f"{rel_path} missing expected course-id meta: {course_id}")
        if "assistant-panel.js" not in content:
            errors.append(f"{rel_path} missing assistant panel wiring")
        if "course-switcher.js" not in content:
            errors.append(f"{rel_path} missing course switcher wiring")

    if errors:
        print("[ERROR] Hub build verification failed")
        for err in errors:
            print(f" - {err}")
        return 1

    print("[OK] Hub build verification passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
