// BMW China MSRP Scraper
// Reads data-href attributes from the model finder page to discover all model URLs,
// then extracts per-trim pricing from the briefData variable embedded in each page.
// Usage: node skill.js
// Output: JSON array to stdout

const { chromium } = require('playwright');

const BASE = 'https://www.bmw.com.cn';
const MODEL_FINDER = `${BASE}/zh/ssl/model-finder.html`;

async function discoverModelUrls(page) {
  await page.goto(MODEL_FINDER, { waitUntil: 'networkidle' });

  const hrefs = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.ds2-car-item[data-href]'))
      .map(el => el.getAttribute('data-href'))
  );

  // Keep only relative /zh/all-models paths (skip external concept-car links)
  return [...new Set(
    hrefs.filter(h => h && h.startsWith('/zh/all-models/'))
  )].map(h => `${BASE}${h}`);
}

function parseBriefData(scriptContent) {
  const match = scriptContent.match(/briefData\s*=\s*JSON\.parse\('([\s\S]+?)'\)/);
  if (!match) return null;
  try {
    const json = match[1]
      .replace(/\\x22/g, '"')
      .replace(/\\x27/g, "'")
      .replace(/\\x3c/gi, '<')
      .replace(/\\x3e/gi, '>')
      .replace(/\\x26/gi, '&')
      .replace(/\\u002D/gi, '-');
    return JSON.parse(json);
  } catch (_) {
    return null;
  }
}

async function extractPricesFromPage(page, url) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
  } catch (_) {
    process.stderr.write(`Skipping (load timeout): ${url}\n`);
    return [];
  }

  const scripts = await page.evaluate(() =>
    Array.from(document.querySelectorAll('script'))
      .map(s => s.textContent)
      .filter(t => t.includes('briefData'))
  );

  const results = [];
  for (const src of scripts) {
    const data = parseBriefData(src);
    if (!data) continue;

    const modelName = data.modelName || '';
    const variants = data.variants || data.displayVariants || [];

    for (const v of variants) {
      if (v.show === 'false') continue;
      const priceYuan = parseFloat(v['price.grossPrice']);
      if (!priceYuan || isNaN(priceYuan)) continue;
      results.push({
        model: modelName,
        trim: v.title || v.name,
        priceYuan,
        priceWan: Math.round((priceYuan / 10000) * 10) / 10,
      });
    }
  }
  return results;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('console', () => {});
  page.on('pageerror', () => {});

  let modelUrls;
  try {
    modelUrls = await discoverModelUrls(page);
    process.stderr.write(`Discovered ${modelUrls.length} model pages\n`);
  } catch (err) {
    process.stderr.write(`URL discovery failed: ${err.message}\n`);
    await browser.close();
    process.exit(1);
  }

  const allResults = [];
  const seen = new Set();

  for (const url of modelUrls) {
    process.stderr.write(`Scraping: ${url}\n`);
    const rows = await extractPricesFromPage(page, url);
    for (const row of rows) {
      const key = `${row.model}||${row.trim}`;
      if (!seen.has(key)) {
        seen.add(key);
        allResults.push(row);
      }
    }
  }

  await browser.close();
  process.stderr.write(`Total unique trims: ${allResults.length}\n`);
  process.stdout.write(JSON.stringify(allResults, null, 2));
}

main().catch(err => {
  process.stderr.write(`Fatal: ${err.message}\n`);
  process.exit(1);
});
