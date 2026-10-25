"""
Download HTML (canonical) and emit LLM-readable Markdown (extracted text).
Uses only stdlib. Encoding: UTF-8; best-effort for legacy pages.
"""
from __future__ import annotations

import argparse
import re
import sys
from datetime import date
from html import unescape
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def html_to_text(html: str) -> str:
    html = re.sub(r"<script[^>]*>.*?</script>", "", html, flags=re.DOTALL | re.I)
    html = re.sub(r"<style[^>]*>.*?</style>", "", html, flags=re.DOTALL | re.I)
    text = re.sub(r"<[^>]+>", "\n", html)
    text = unescape(text)
    text = re.sub(r"[ \t\r\f\v]+", " ", text)
    text = re.sub(r"\n\s*\n+", "\n\n", text)
    return text.strip()


def fetch(url: str) -> bytes:
    req = Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; WalletHub-compliance-archiver/1.0)",
            "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.5",
        },
    )
    with urlopen(req, timeout=90) as resp:
        return resp.read()


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--url", default="", help="Source URL (omit with --from-file)")
    p.add_argument(
        "--from-file",
        action="store_true",
        help="Read existing HTML at --canonical-out instead of fetching",
    )
    p.add_argument("--canonical-out", required=True, help="Path for raw HTML snapshot")
    p.add_argument("--md-out", required=True, help="Path for extracted .md")
    p.add_argument("--id", required=True, help="Document id e.g. BR-001")
    p.add_argument("--title", required=True)
    p.add_argument("--kind", default="extracted", choices=("extracted", "excerpt", "summary"))
    p.add_argument("--max-chars", type=int, default=1_200_000)
    args = p.parse_args()

    canonical_path = Path(args.canonical_out)

    if args.from_file:
        if not canonical_path.is_file():
            print(f"ERROR: --from-file requires existing {canonical_path}", file=sys.stderr)
            return 1
        raw = canonical_path.read_bytes()
        source_url = args.url or f"file://{canonical_path.resolve().as_posix()}"
    else:
        if not args.url:
            print("ERROR: provide --url or use --from-file with existing HTML", file=sys.stderr)
            return 1
        try:
            raw = fetch(args.url)
        except (URLError, HTTPError, TimeoutError, OSError) as e:
            print(f"ERROR: fetch failed: {e}", file=sys.stderr)
            return 1
        source_url = args.url
        canonical_path.parent.mkdir(parents=True, exist_ok=True)
        canonical_path.write_bytes(raw)

    for enc in ("utf-8", "latin-1", "cp1252"):
        try:
            html = raw.decode(enc)
            break
        except UnicodeDecodeError:
            html = None
    else:
        html = raw.decode("utf-8", errors="replace")

    body = html_to_text(html)
    truncated = False
    if len(body) > args.max_chars:
        body = (
            body[: args.max_chars]
            + "\n\n---\n\n*(Texto truncado para limite de tamanho; ver ficheiro canónico HTML e fonte.)*\n"
        )
        truncated = True
        kind = "excerpt"
    else:
        kind = args.kind

    today = date.today().isoformat()
    rel_canonical = Path(args.canonical_out).as_posix()
    front = f"""---
id: {args.id}
title: "{args.title.replace('"', "'")}"
canonical_path: {rel_canonical}
source_url: "{source_url}"
obtained_date: {today}
kind: {kind}
truncated: {str(truncated).lower()}
---

# {args.title}

**Fonte:** {source_url}

---

{body}
"""
    md_path = Path(args.md_out)
    md_path.parent.mkdir(parents=True, exist_ok=True)
    md_path.write_text(front, encoding="utf-8")
    print(f"OK canonical={canonical_path} ({len(raw)} bytes) md={md_path} ({len(front)} chars)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
