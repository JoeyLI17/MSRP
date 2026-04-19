# BMW MSRP Skill

Use this skill to fetch BMW MSRP data with a default focus on BMW China official pages.

## Default source

- `https://www.bmw.com.cn/zh/all-models.html`

## Agent usage

1. Start with the default URL above unless another BMW China official URL is provided.
2. Run `fetch_price.py` to extract RMB/MSRP-like price strings from page content.
3. Return the extracted prices with source URL.

## Run

```bash
python skills/BMW/fetch_price.py
python skills/BMW/fetch_price.py --url "https://www.bmw.com.cn/zh/all-models/5-series/sedan/2024/overview.html"
```
