#!/usr/bin/env python3
"""Genera un manifiesto auditable del último build del hub."""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        while True:
            chunk = f.read(1024 * 1024)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def git_rev(path: Path) -> str:
    try:
        out = subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=str(path),
            stderr=subprocess.DEVNULL,
            text=True,
        ).strip()
        return out or "unknown"
    except Exception:
        return "unknown"


def build_course_entry(name: str, repo_root: Path, src_html: Path, dst_html: Path) -> dict:
    src_exists = src_html.exists()
    dst_exists = dst_html.exists()
    return {
        "name": name,
        "repoPath": str(repo_root),
        "repoCommit": git_rev(repo_root),
        "sourceHtml": str(src_html),
        "destHtml": str(dst_html),
        "sourceExists": src_exists,
        "destExists": dst_exists,
        "sourceSizeBytes": src_html.stat().st_size if src_exists else 0,
        "destSizeBytes": dst_html.stat().st_size if dst_exists else 0,
        "sourceSha256": sha256_file(src_html) if src_exists else "",
        "destSha256": sha256_file(dst_html) if dst_exists else "",
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate hub build manifest")
    parser.add_argument("--mode", required=True, choices=["strict", "fast"])
    parser.add_argument("--sdd-audit-ran", required=True, choices=["0", "1"])
    parser.add_argument("--runtime-smoke-ran", required=True, choices=["0", "1"])
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    script_dir = Path(__file__).resolve().parent
    hub_root = script_dir.parent
    projects_root = hub_root.parent
    runtime_dir = hub_root / ".runtime"
    runtime_dir.mkdir(parents=True, exist_ok=True)

    ios_repo = projects_root / "stack-my-architecture-ios"
    android_repo = projects_root / "stack-my-architecture-android"
    sdd_repo = projects_root / "stack-my-architecture-SDD"

    data = {
        "schemaVersion": 1,
        "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
        "mode": args.mode,
        "gates": {
            "sddFullAuditRan": args.sdd_audit_ran == "1",
            "runtimeSmokeRan": args.runtime_smoke_ran == "1",
        },
        "hub": {
            "path": str(hub_root),
            "commit": git_rev(hub_root),
        },
        "courses": {
            "ios": build_course_entry(
                "ios",
                ios_repo,
                ios_repo / "dist/curso-stack-my-architecture.html",
                hub_root / "ios/curso-stack-my-architecture.html",
            ),
            "android": build_course_entry(
                "android",
                android_repo,
                android_repo / "dist/curso-stack-my-architecture-android.html",
                hub_root / "android/curso-stack-my-architecture-android.html",
            ),
            "sdd": build_course_entry(
                "sdd",
                sdd_repo,
                sdd_repo / "dist/curso-stack-my-architecture-sdd.html",
                hub_root / "sdd/curso-stack-my-architecture-sdd.html",
            ),
        },
    }

    output = runtime_dir / "build-manifest.json"
    output.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"[OK] Build manifest generated: {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
