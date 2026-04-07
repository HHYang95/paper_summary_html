"""
Build papers.json from HTML meta tags.

Scans all paper HTML files in the current directory, extracts metadata
from <meta name="paper-*"> tags, importance stars, and overview text,
then writes papers.json for the master page.

Usage:
    python build_papers_json.py

Run after adding/removing paper HTML files to regenerate the index.
"""

import json
import os
import re
import sys
from html.parser import HTMLParser
from pathlib import Path


class PaperMetaExtractor(HTMLParser):
    """Extract paper-* meta tags from HTML head."""

    def __init__(self):
        super().__init__()
        self.metas: dict[str, str] = {}

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == 'meta':
            d = dict(attrs)
            name = d.get('name', '')
            if name.startswith('paper-'):
                self.metas[name] = d.get('content', '')


def extract_importance(html: str) -> int:
    """Count filled stars in the importance-badge div."""
    m = re.search(r'importance-badge[^>]*>(.*?)</div>', html)
    if m:
        return m.group(1).count('\u2605')  # ★
    return 0


def extract_overview(html: str) -> str:
    """Extract plain text from the overview-text div."""
    m = re.search(r'class="overview-text">(.*?)</div>', html, re.DOTALL)
    if not m:
        return ''
    text = re.sub(r'<[^>]+>', '', m.group(1)).strip()
    # Collapse whitespace
    text = re.sub(r'\s+', ' ', text)
    # Truncate to ~300 chars for JSON size
    if len(text) > 300:
        text = text[:297].rsplit(' ', 1)[0] + '...'
    return text


def build_paper_entry(filepath: Path) -> dict | None:
    """Parse a single HTML file and return a paper dict."""
    try:
        content = filepath.read_text(encoding='utf-8')
    except Exception as e:
        print(f"  WARN: Cannot read {filepath.name}: {e}", file=sys.stderr)
        return None

    # Extract meta tags
    parser = PaperMetaExtractor()
    parser.feed(content[:5000])  # Meta tags are in the head
    meta = parser.metas

    title = meta.get('paper-title', '')
    if not title:
        print(f"  SKIP: {filepath.name} — no paper-title meta tag", file=sys.stderr)
        return None

    # Parse tags string into list
    tags_str = meta.get('paper-tags', '')
    tags = [t.strip() for t in tags_str.split(',') if t.strip()]

    # Parse year
    year_str = meta.get('paper-year', '0')
    try:
        year = int(year_str)
    except ValueError:
        year = 0

    return {
        'id': filepath.stem,
        'title': title,
        'authors': meta.get('paper-author', ''),
        'year': year,
        'journal': meta.get('paper-journal', ''),
        'tags': tags,
        'doi': meta.get('paper-doi', ''),
        'abstract': extract_overview(content),
        'importance': extract_importance(content),
        'file': filepath.name,
    }


def main() -> None:
    script_dir = Path(__file__).parent
    html_files = sorted(
        f for f in script_dir.glob('*.html')
        if f.name != 'index.html'
    )

    print(f"Scanning {len(html_files)} HTML files...")
    papers = []
    for f in html_files:
        entry = build_paper_entry(f)
        if entry:
            papers.append(entry)

    # Sort by year descending (newest first)
    papers.sort(key=lambda p: p['year'], reverse=True)

    out_path = script_dir / 'papers.json'
    out_path.write_text(json.dumps(papers, indent=2, ensure_ascii=False), encoding='utf-8')
    print(f"Written {len(papers)} papers to {out_path.name}")


if __name__ == '__main__':
    main()
