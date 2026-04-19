#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import sys

DEFAULT_URL = "https://www.mercedes-benz.com.cn/passengercars.html"
PRICE_PATTERN = re.compile(r"(?:¥|￥|RMB\s*)\s*\d[\d,]*(?:\.\d{1,2})?\s*(?:万|元)?")


def extract_prices(text: str) -> list[str]:
    unique: list[str] = []
    seen: set[str] = set()
    for raw in PRICE_PATTERN.findall(text):
        value = " ".join(raw.split())
        if value not in seen:
            seen.add(value)
            unique.append(value)
    return unique


def fetch_dynamic_text(url: str, timeout_ms: int = 30000) -> str:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as exc:
        raise RuntimeError(
            "Playwright is required for dynamic page extraction. "
            "Install with: pip install playwright && playwright install chromium"
        ) from exc

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
        page.wait_for_load_state("networkidle", timeout=timeout_ms)
        text = page.inner_text("body")
        browser.close()
        return text


def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch Mercedes-Benz MSRP-like prices from dynamic China pages.")
    parser.add_argument("--url", default=DEFAULT_URL, help="Mercedes-Benz China official page URL")
    args = parser.parse_args()

    try:
        body_text = fetch_dynamic_text(args.url)
    except Exception as exc:
        print(json.dumps({"oem": "Benz", "source_url": args.url, "error": str(exc)}, ensure_ascii=False, indent=2))
        return 1

    prices = extract_prices(body_text)
    print(json.dumps({"oem": "Benz", "source_url": args.url, "prices": prices}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
