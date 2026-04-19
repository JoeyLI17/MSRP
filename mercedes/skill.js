// Mercedes-Benz China MSRP Scraper
// Fetches all model pricing from the official bodystyle API in a single call.
// Usage: node skill.js
// Output: JSON array to stdout

const API = 'https://www.mercedes-benz.com.cn/api/graphql/bodystyle?preview=false';

async function main() {
  const res = await fetch(API, {
    headers: { 'Referer': 'https://www.mercedes-benz.com.cn/' }
  });

  if (!res.ok) {
    process.stderr.write(`API error: ${res.status} ${res.statusText}\n`);
    process.exit(1);
  }

  const { data } = await res.json();
  const results = [];
  const seen = new Set();

  for (const bodyStyle of data.bodyStyles) {
    for (const cls of bodyStyle.classes) {
      for (const model of cls.models) {
        // Skip models without a published price
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

  process.stderr.write(`Total models: ${results.length}\n`);
  process.stdout.write(JSON.stringify(results, null, 2));
}

main().catch(err => {
  process.stderr.write(`Fatal: ${err.message}\n`);
  process.exit(1);
});
