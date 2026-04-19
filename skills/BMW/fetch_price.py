#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from urllib.request import Request, urlopen

DEFAULT_URL = "https://www.bmw.com.cn/zh/all-models.html"
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


def fetch_html(url: str, timeout: int = 20) -> str:
    req = Request(url, headers={"User-Agent": "Mozilla/5.0 MSRP-Agent/1.0"})
    with urlopen(req, timeout=timeout) as response:
        return response.read().decode("utf-8", errors="ignore")


def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch BMW MSRP-like prices from China official pages.")
    parser.add_argument("--url", default=DEFAULT_URL, help="BMW China official page URL")
    args = parser.parse_args()

    try:
        html = fetch_html(args.url)
    except Exception as exc:
        print(json.dumps({"oem": "BMW", "source_url": args.url, "error": str(exc)}, ensure_ascii=False, indent=2))
        return 1

    prices = extract_prices(html)

    print(json.dumps({"oem": "BMW", "source_url": args.url, "prices": prices}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
