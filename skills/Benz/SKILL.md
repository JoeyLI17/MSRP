# Benz MSRP Skill

Use this skill to fetch Mercedes-Benz MSRP data with a default focus on Mercedes-Benz China official pages.

## Default source

- `https://www.mercedes-benz.com.cn/passengercars.html`

## Agent usage

1. Start with the default URL above unless another Mercedes-Benz China official URL is provided.
2. Use `fetch_price_dynamic.py` for dynamic pages that render price content with JavaScript.
3. Return extracted RMB/MSRP-like prices with source URL.

## Run

```bash
python /home/runner/work/MSRP/MSRP/skills/Benz/fetch_price_dynamic.py
python /home/runner/work/MSRP/MSRP/skills/Benz/fetch_price_dynamic.py --url "https://www.mercedes-benz.com.cn/passengercars/models/suv/gla/overview.html"
```

If Playwright is not installed:

```bash
pip install playwright
playwright install chromium
```
