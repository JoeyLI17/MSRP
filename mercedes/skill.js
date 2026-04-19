// Mercedes-Benz China MSRP Scraper
// Primary path: graphql/bodystyle API for all normally-priced trims.
// Supplement: sitemap → vehicles API → estore API for models using the estore
//   order flow (e.g. 纯电CLA), where classId is embedded in CTA links.
// Usage: node skill.js
// Output: JSON array to stdout

const BASE = 'https://www.mercedes-benz.com.cn';
const ESTORE = 'https://estore.mercedes-benz.com.cn';

async function fetchJson(url, headers = {}) {
  const res = await fetch(url, { headers: { Referer: BASE + '/', ...headers } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { Referer: BASE + '/' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

// Step 1: bodystyle API — all trims with a published MSRP
async function fetchBodystyleModels() {
  const { data } = await fetchJson(`${BASE}/api/graphql/bodystyle?preview=false`);
  const results = [];
  const seen = new Set();

  for (const bodyStyle of data.bodyStyles) {
    for (const cls of bodyStyle.classes) {
      for (const model of cls.models) {
        if (model.hideMsrp || model.publishedMsrp === null || model.publishedMsrp === undefined) continue;
        const key = `${cls.cnName}||${model.cnName}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const priceYuan = model.publishedMsrp;
        results.push({
          model: cls.cnName,
          trim: model.cnName,
          priceYuan,
          priceWan: Math.round((priceYuan / 10000) * 100) / 100,
        });
      }
    }
  }
  return results;
}

// Step 2: discover classIds by scanning all vehicle pages via sitemap
async function discoverEstoreClassIds() {
  const sitemapXml = await fetchText(`${BASE}/sitemap.xml`);
  const allUrls = [...sitemapXml.matchAll(/<loc>(https?:\/\/[^<]+)<\/loc>/g)].map(m => m[1]);
  const vehicleSlugs = allUrls
    .filter(u => u.includes('/vehicles/'))
    .map(u => u.replace(/^https?:\/\/[^/]+\/vehicles\//, '').replace(/\.html$/, ''));

  // Fetch each vehicle page's API data and extract classId=XXX from content
  const classIdMap = new Map(); // classId → {className, classId}
  await Promise.all(vehicleSlugs.map(async slug => {
    try {
      const text = await fetchText(`${BASE}/api/vehicles?url=${slug}`);
      const matches = [...text.matchAll(/classId=([A-Z][A-Z0-9]+)/g)].map(m => m[1]);
      if (!matches.length) return;
      // Parse JSON to get className
      let className = '';
      try {
        const parsed = JSON.parse(text);
        className = parsed?.data?.model?.cnName || parsed?.data?.name || slug;
      } catch (_) {
        className = slug;
      }
      for (const classId of matches) {
        if (!classIdMap.has(classId)) {
          classIdMap.set(classId, { className, classId });
        }
      }
    } catch (_) {}
  }));
  return classIdMap;
}

// Step 3: for each classId, fetch estore trims
async function fetchEstoreTrims(className, classId) {
  const resp = await fetchJson(
    `${ESTORE}/api/ecommerce/customers/vehicles/nsts?classId=${classId}`
  );
  const data = Array.isArray(resp) ? resp : (resp.data || []);
  const results = [];
  for (const item of data) {
    if (!item.price) continue;
    const priceYuan = parseFloat(item.price);
    if (!priceYuan || isNaN(priceYuan)) continue;
    results.push({
      model: className,
      trim: item.name,
      priceYuan,
      priceWan: Math.round((priceYuan / 10000) * 100) / 100,
    });
  }
  return results;
}

async function main() {
  // Normal bodystyle models
  const bodystyleResults = await fetchBodystyleModels();
  process.stderr.write(`Bodystyle models: ${bodystyleResults.length}\n`);

  // Estore supplement for classId-based models (e.g. 纯电CLA)
  const classIdMap = await discoverEstoreClassIds();
  process.stderr.write(`Discovered estore classIds: ${[...classIdMap.keys()].join(', ')}\n`);

  const seen = new Set(bodystyleResults.map(r => `${r.model}||${r.trim}`));
  const estoreResults = [];

  for (const { className, classId } of classIdMap.values()) {
    try {
      const trims = await fetchEstoreTrims(className, classId);
      for (const t of trims) {
        const key = `${t.model}||${t.trim}`;
        if (!seen.has(key)) {
          seen.add(key);
          estoreResults.push(t);
        }
      }
      process.stderr.write(`  ${classId} (${className}): ${trims.length} trims\n`);
    } catch (err) {
      process.stderr.write(`  ${classId} estore failed: ${err.message}\n`);
    }
  }

  const allResults = [...bodystyleResults, ...estoreResults];
  process.stderr.write(`Total models: ${allResults.length}\n`);
  process.stdout.write(JSON.stringify(allResults, null, 2));
}

main().catch(err => {
  process.stderr.write(`Fatal: ${err.message}\n`);
  process.exit(1);
});
