#!/usr/bin/env python3
"""Static HTTP server with aggressive no-cache headers."""

from __future__ import annotations

import argparse
import os
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCacheHandler(SimpleHTTPRequestHandler):
    """Serve static files while forcing browsers to revalidate every request."""

    def end_headers(self) -> None:  # noqa: D401
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        self.send_header("Surrogate-Control", "no-store")
        super().end_headers()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="No-cache static server")
    parser.add_argument("--port", type=int, default=8090, help="Port to bind (default: 8090)")
    parser.add_argument(
        "--directory",
        default=".",
        help="Directory to serve (default: current directory)",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    directory = os.path.abspath(args.directory)
    handler = partial(NoCacheHandler, directory=directory)
    httpd = ThreadingHTTPServer(("0.0.0.0", args.port), handler)
    print(f"[no-cache-server] Serving {directory} on http://localhost:{args.port}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
