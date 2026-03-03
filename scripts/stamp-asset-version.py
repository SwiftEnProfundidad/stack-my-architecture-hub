#!/usr/bin/env python3
"""Stamp local asset URLs with a shared build version query string."""

from __future__ import annotations

import argparse
import re
from datetime import datetime, timezone
from pathlib import Path

ASSET_PATTERN = re.compile(
    r"(assets/[A-Za-z0-9._/-]+\.(?:css|js)\?v=)([A-Za-z0-9._-]+)"
)

DEFAULT_TARGETS = [
    "ios/index.html",
    "ios/curso-stack-my-architecture.html",
    "android/index.html",
    "android/curso-stack-my-architecture-android.html",
    "sdd/index.html",
    "sdd/curso-stack-my-architecture-sdd.html",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Stamp asset ?v= version in generated HTML files")
    parser.add_argument(
        "--hub-root",
        default=str(Path(__file__).resolve().parent.parent),
        help="Hub root directory",
    )
    parser.add_argument(
        "--version",
        default="",
        help="Version value to inject (default: UTC epoch seconds)",
    )
    parser.add_argument(
        "--target",
        action="append",
        default=[],
        help="Relative HTML path to patch; can be used multiple times",
    )
    return parser.parse_args()


def resolve_version(raw: str) -> str:
    clean = str(raw or "").strip()
    if clean:
        return clean
    now = datetime.now(timezone.utc)
    return str(int(now.timestamp()))


def patch_html(path: Path, version: str) -> bool:
    if not path.exists() or not path.is_file():
        return False
    content = path.read_text(encoding="utf-8")
    patched = ASSET_PATTERN.sub(lambda match: f"{match.group(1)}{version}", content)
    if patched == content:
        return False
    path.write_text(patched, encoding="utf-8")
    return True


def main() -> int:
    args = parse_args()
    hub_root = Path(args.hub_root).resolve()
    version = resolve_version(args.version)
    targets = args.target or DEFAULT_TARGETS

    changed = []
    for rel in targets:
        file_path = hub_root / rel
        if patch_html(file_path, version):
            changed.append(str(file_path))

    print(f"[stamp-asset-version] version={version}")
    if changed:
        print("[stamp-asset-version] patched files:")
        for file_path in changed:
            print(f"  - {file_path}")
    else:
        print("[stamp-asset-version] no files needed patching")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
