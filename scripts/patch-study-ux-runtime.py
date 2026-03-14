#!/usr/bin/env python3

from __future__ import annotations

import argparse
from pathlib import Path

COURSES = ("ios", "android", "sdd")

JS_REPLACEMENTS = [
    (
        """    const bookmarksCopy = document.createElement('p');\n    bookmarksCopy.textContent = 'Tus puntos guardados más recientes para volver rápido a temas importantes.';\n    const bookmarksList = document.createElement('div');\n    bookmarksList.id = 'study-bookmarks-list';\n    bookmarksList.className = 'study-bookmarks-list';\n    bookmarksBox.appendChild(bookmarksTitle);\n    bookmarksBox.appendChild(bookmarksCopy);\n    bookmarksBox.appendChild(bookmarksList);\n""",
        """    const bookmarksCopy = document.createElement('p');\n    bookmarksCopy.textContent = 'Tus puntos guardados más recientes para volver rápido a temas importantes.';\n    const bookmarksList = document.createElement('div');\n    bookmarksList.id = 'study-bookmarks-list';\n    bookmarksList.className = 'study-bookmarks-list';\n    const bookmarksStatus = document.createElement('p');\n    bookmarksStatus.id = 'study-bookmark-status';\n    bookmarksStatus.className = 'study-bookmark-status';\n    bookmarksBox.appendChild(bookmarksTitle);\n    bookmarksBox.appendChild(bookmarksCopy);\n    bookmarksBox.appendChild(bookmarksList);\n    bookmarksBox.appendChild(bookmarksStatus);\n""",
    ),
    (
        """    function renderBookmarksPanel() {\n      const list = document.getElementById('study-bookmarks-list');\n      if (!list) return;\n\n      if (!hasAuthenticatedCloudProfile()) {\n        list.innerHTML = '<p class=\\"study-bookmarks-empty\\">Inicia sesión para sincronizar bookmarks privados entre dispositivos.</p>';\n        return;\n      }\n""",
        """    function renderBookmarksPanel() {\n      const list = document.getElementById('study-bookmarks-list');\n      const status = document.getElementById('study-bookmark-status');\n      if (!list) return;\n\n      if (!hasAuthenticatedCloudProfile()) {\n        list.innerHTML = '<p class=\\"study-bookmarks-empty\\">Inicia sesión para sincronizar bookmarks privados entre dispositivos.</p>';\n        if (status) status.textContent = 'Los bookmarks cloud están disponibles solo con sesión activa.';\n        return;\n      }\n""",
    ),
    (
        """      if (!items.length) {\n        list.innerHTML = '<p class=\\"study-bookmarks-empty\\">Todavía no has guardado ningún bookmark.</p>';\n        return;\n      }\n\n      list.innerHTML = items.map(function (item) {\n""",
        """      if (!items.length) {\n        list.innerHTML = '<p class=\\"study-bookmarks-empty\\">Todavía no has guardado ningún bookmark.</p>';\n        if (status) status.textContent = 'Guarda un bookmark para volver rápido a una lección importante.';\n        return;\n      }\n\n      if (status) status.textContent = 'Tus bookmarks recientes quedan ligados a tu cuenta y se sincronizan entre dispositivos.';\n\n      list.innerHTML = items.map(function (item) {\n""",
    ),
    (
        """    async function toggleBookmark() {\n      if (!currentTopic) return;\n      if (!hasAuthenticatedCloudProfile()) {\n        goAuthPortal();\n        return;\n      }\n\n      try {\n""",
        """    async function toggleBookmark() {\n      if (!currentTopic) return;\n      if (!hasAuthenticatedCloudProfile()) {\n        goAuthPortal();\n        return;\n      }\n\n      const status = document.getElementById('study-bookmark-status');\n      try {\n""",
    ),
    (
        """        if (body.active) {\n          state.bookmarksByTopicId[currentTopic.id] = {\n            updatedAt: String(body.bookmark && body.bookmark.updatedAt || new Date().toISOString())\n          };\n        } else {\n          delete state.bookmarksByTopicId[currentTopic.id];\n        }\n        render();\n        scheduleDecorateNavStates();\n      } catch (_error) {\n      }\n""",
        """        if (body.active) {\n          state.bookmarksByTopicId[currentTopic.id] = {\n            updatedAt: String(body.bookmark && body.bookmark.updatedAt || new Date().toISOString())\n          };\n        } else {\n          delete state.bookmarksByTopicId[currentTopic.id];\n        }\n        if (status) {\n          status.textContent = body.active\n            ? `Bookmark guardado para ${currentTopic.lessonLabel || currentTopic.id}.`\n            : `Bookmark eliminado de ${currentTopic.lessonLabel || currentTopic.id}.`;\n        }\n        render();\n        scheduleDecorateNavStates();\n      } catch (error) {\n        if (status) status.textContent = error && error.message ? error.message : 'No se pudo actualizar el bookmark.';\n      }\n""",
    ),
]

CSS_REPLACEMENTS = [
    (
        """.study-interview-chip {\n  border: 1px solid rgba(96, 165, 250, 0.24);\n  border-radius: 999px;\n  background: rgba(15, 23, 42, 0.72);\n  color: var(--text, #e5e7eb);\n""",
        """.study-interview-chip {\n  border: 1px solid color-mix(in oklab, var(--accent, #60a5fa), var(--border, #334155) 55%);\n  border-radius: 999px;\n  background: color-mix(in oklab, var(--bg, #ffffff), var(--accent, #60a5fa) 8%);\n  color: var(--text, #111827);\n""",
    ),
    (
        """.study-interview-chip.is-active {\n  border-color: rgba(96, 165, 250, 0.42);\n  background: rgba(59, 130, 246, 0.18);\n}\n""",
        """.study-interview-chip.is-active {\n  border-color: color-mix(in oklab, var(--accent, #60a5fa), #ffffff 18%);\n  background: color-mix(in oklab, var(--accent, #60a5fa), var(--bg, #ffffff) 82%);\n}\n""",
    ),
    (
        """.study-interview-card {\n  display: grid;\n  gap: 14px;\n  border: 1px solid rgba(148, 163, 184, 0.18);\n  border-radius: 12px;\n  background: rgba(15, 23, 42, 0.82);\n  padding: 14px;\n}\n""",
        """.study-interview-card {\n  display: grid;\n  gap: 14px;\n  border: 1px solid color-mix(in oklab, var(--border, #334155), #ffffff 12%);\n  border-radius: 12px;\n  background: color-mix(in oklab, var(--bg, #ffffff), var(--bg-surface, #f6f8fa) 58%);\n  padding: 14px;\n  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.08);\n}\n""",
    ),
    (
        """.study-interview-source {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  min-height: 38px;\n  padding: 8px 12px;\n  border-radius: 10px;\n  border: 1px solid rgba(96, 165, 250, 0.28);\n  background: rgba(59, 130, 246, 0.12);\n  color: var(--text, #e5e7eb);\n""",
        """.study-interview-source {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  min-height: 38px;\n  padding: 8px 12px;\n  border-radius: 10px;\n  border: 1px solid color-mix(in oklab, var(--accent, #60a5fa), var(--border, #334155) 48%);\n  background: color-mix(in oklab, var(--accent, #60a5fa), var(--bg, #ffffff) 88%);\n  color: var(--text, #111827);\n""",
    ),
    (
        """.study-interview-empty {\n  margin: 0;\n  color: var(--text-secondary, #cbd5e1);\n}\n""",
        """.study-interview-empty {\n  margin: 0;\n  color: var(--text-secondary, #cbd5e1);\n}\n\n.study-bookmark-status {\n  margin: 0;\n  font-size: 0.82rem;\n  color: var(--text-secondary, #cbd5e1);\n}\n""",
    ),
]


def patch_file(path: Path, replacements: list[tuple[str, str]]) -> bool:
    content = path.read_text(encoding="utf-8")
    patched = content
    changed = False
    for before, after in replacements:
        if after in patched:
            continue
        if before not in patched:
            raise RuntimeError(f"No se encontró el bloque esperado en {path}")
        patched = patched.replace(before, after, 1)
        changed = True
    if changed:
        path.write_text(patched, encoding="utf-8")
    return changed


def main() -> int:
    parser = argparse.ArgumentParser(description="Apply Hub-only runtime UX hotfixes after copying course outputs")
    parser.add_argument("--hub-root", default=str(Path(__file__).resolve().parent.parent))
    args = parser.parse_args()

    hub_root = Path(args.hub_root).resolve()
    patched = []
    for course in COURSES:
        js_path = hub_root / course / "assets" / "study-ux.js"
        css_path = hub_root / course / "assets" / "study-ux.css"
        if patch_file(js_path, JS_REPLACEMENTS):
            patched.append(js_path)
        if patch_file(css_path, CSS_REPLACEMENTS):
            patched.append(css_path)

    print("[patch-study-ux-runtime] patched files:")
    for path in patched:
        print(f"  - {path}")
    if not patched:
        print("  - none (already patched)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
