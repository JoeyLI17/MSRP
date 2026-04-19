# MSRP
Get MSRP of cars as an agent skill

# Skill Protocol
This skill set follows the Claude Skills best practices, see https://docs.claude.com/build-skills

---

# Detailed Plan

## Overview
For each vehicle OEM, build a Claude Agent skill that:
1. Scrapes the official website for all current model/trim MSRPs
2. Outputs results to `data/{BRAND}.csv` with date-stamped price columns
3. Tracks changes over time (new models, discontinued models, price changes)
4. Generates price change reports in `report/`

---

## Directory Structure

```
msrp/
├── plan.md
├── data/                          # Created at runtime, one CSV per brand
│   └── BMW.csv
├── report/                        # Created at runtime, price change reports
│   └── BMW_price_changes_2026-04-19.csv
└── bmw/                           # One folder per OEM
    ├── skill.json                 # Claude skill definition
    ├── skill.js                   # Playwright scraper (Node.js)
    └── run.py                     # Orchestration script (Python)
```

---

## BMW Skill

### Source
- Website: https://www.bmw.com.cn/zh/index_new.html
- Technology: Dynamic JS (AEM + custom DS2 framework)

### How Pricing Works (Reverse-Engineered)
Every BMW model "inspire" page embeds a `briefData` JavaScript variable in a `<script>` tag with the following structure:
```json
{
  "startPrice": "￥ 258,000",
  "modelName": "BMW 3系",
  "modelRange": "G20",
  "displayVariants": [
    {
      "name": "31FH_0ZMC",
      "title": "325Li M运动套装",
      "price": "￥ 278,000",
      "price.grossPrice": "278000.00",
      "ucpModelCode": "G28",
      "wheelbase": "LK",
      "show": "true"
    }
  ]
}
```
- `price.grossPrice` is the numeric MSRP in 元 → divide by 10000 for 万元
- One inspire page can contain multiple model codes (e.g., LWB + SWB variants of 3 Series)
- Limited editions use separate `tdr.html` pages with same `briefData` structure

### Model Catalog Discovery
All model codes/names are embedded as base64-encoded JSON in a hidden `.all-models-data` div present on every page:
- Series: BMW i, 2, 3, 4, 5, 7, 8, X, M, Z — ~55 model codes total
- Each model code (e.g. `G28`, `G20`, `G28BEV`) maps to a named model

### URL Discovery Strategy (`skill.js`)
1. Navigate to homepage
2. Click each series tab (BMW i, 2, 3, 4, 5, 7, 8, X, M, Z)
3. Collect model card click-through URLs from the nav dropdown
4. Also scrape model finder page (`/zh/ssl/model-finder.html`) for additional/special-edition URLs
5. Deduplicate URLs

### Scraping Logic (`skill.js`)
For each discovered model page URL:
1. Navigate to the page
2. Find all `<script>` tags containing `briefData`
3. Parse the JSON (handle `\x22` hex escapes)
4. Extract: `modelName`, each variant's `title` + `price.grossPrice`
5. Return array of `{ model, trim, priceYuan }`

### Output Format (`run.py`)

**`data/BMW.csv`**
| brand | model | trim | 2026-04-19 | 2026-05-01 |
|-------|-------|------|------------|------------|
| BMW | BMW 3系 | 325Li M运动套装 | 27.8 | 27.8 |
| BMW | BMW 3系 | 330Li M运动曜夜套装 | 30.8 | 29.8 |
| ~~BMW~~ | ~~BMW 3系~~ | ~~330i M运动套装~~ | ~~29.8~~ | | 

- MSRP column header = date the skill was run (YYYY-MM-DD)
- Values in 万元 (e.g. 27.8 means ￥278,000)
- If brand CSV already exists: add a new date column, do not overwrite
- New model/trim since last run: highlight cell with yellow background (using openpyxl)
- Discontinued model/trim (present before, missing now): strikethrough text
- Price changed: highlight the new price cell in orange

**`report/BMW_price_changes_{date}.csv`**
Only generated if prices changed. Columns:
| brand | model | trim | old_date | old_price | new_date | new_price | change |
- `change` = new_price - old_price (in 万元, signed)

---

## skill.json Schema
```json
{
  "name": "bmw-msrp",
  "description": "Fetches all current BMW China MSRP prices by model and trim",
  "version": "1.0.0",
  "input_schema": {
    "type": "object",
    "properties": {},
    "required": []
  },
  "output_schema": {
    "type": "array",
    "items": {
      "type": "object",
      "properties": {
        "model": { "type": "string" },
        "trim":  { "type": "string" },
        "priceWan": { "type": "number", "description": "MSRP in 万元" }
      }
    }
  }
}
```

---

## run.py Workflow
1. Call `skill.js` via Node.js subprocess to get raw price data (JSON)
2. Load existing `data/BMW.csv` if it exists (via openpyxl for formatting support)
3. Today's date → new column header
4. For each scraped row:
   - If new model/trim: add row, highlight yellow
   - If existing: write new price, highlight orange if changed
5. For rows in existing CSV not in scraped data: apply strikethrough
6. Save `data/BMW.csv`
7. If any prices changed: write `report/BMW_price_changes_{date}.csv`

---

## Build Order
1. `bmw/skill.js` — Playwright scraper, outputs JSON to stdout
2. `bmw/skill.json` — Skill definition
3. `bmw/run.py` — CSV management and reporting

---

## Future OEMs
Same pattern for each brand. Add a new folder per OEM (e.g. `mercedes/`, `audi/`, `toyota/`).
Each will have its own URL discovery and `briefData`-equivalent extraction logic.
