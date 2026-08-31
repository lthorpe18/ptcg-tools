import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const url = process.env.EVENT_LOCATOR_URL || 'https://events.pokemon.com/EventLocator/?locale=en-GB&range=100&startdate=2026-08-31&iskm=false&latitude=51.4545&longitude=-2.5879';
const outDir = 'artifacts/event-locator-probe';
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  locale: 'en-GB',
  timezoneId: 'Europe/London',
  viewport: { width: 1440, height: 1200 },
});
const page = await context.newPage();
const network = [];

page.on('response', async response => {
  const req = response.request();
  const headers = await response.allHeaders().catch(() => ({}));
  const type = req.resourceType();
  const record = {
    url: response.url(),
    status: response.status(),
    method: req.method(),
    resourceType: type,
    contentType: headers['content-type'] || '',
  };
  if (/json|javascript|event|location|api/i.test(`${record.url} ${record.contentType}`)) {
    try {
      const text = await response.text();
      record.bodySample = text.slice(0, 20000);
    } catch {}
  }
  network.push(record);
});

console.log(`Opening ${url}`);
const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
console.log(`Navigation status: ${response?.status() ?? 'n/a'}`);
await page.waitForTimeout(15000);

const title = await page.title();
const bodyText = await page.locator('body').innerText().catch(() => '');
const eventTitles = await page.locator('.event-info__title').allTextContents().catch(() => []);
const candidateNodes = await page.locator('[class*="event"], [class*="location"]').evaluateAll(nodes => nodes.slice(0, 150).map(n => ({
  tag: n.tagName,
  className: typeof n.className === 'string' ? n.className : '',
  text: (n.textContent || '').trim().slice(0, 500),
}))).catch(() => []);

await fs.writeFile(`${outDir}/network.json`, JSON.stringify(network, null, 2));
await fs.writeFile(`${outDir}/page.html`, await page.content());
await fs.writeFile(`${outDir}/body.txt`, bodyText);
await fs.writeFile(`${outDir}/candidate-nodes.json`, JSON.stringify(candidateNodes, null, 2));
await page.screenshot({ path: `${outDir}/page.png`, fullPage: true }).catch(() => {});

const jsonish = network.filter(r => /json/i.test(r.contentType) || /api|event|location/i.test(r.url));
console.log(JSON.stringify({
  title,
  bodySample: bodyText.slice(0, 1500),
  eventTitleCount: eventTitles.length,
  eventTitles: eventTitles.slice(0, 30),
  candidateNodeCount: candidateNodes.length,
  interestingNetworkCount: jsonish.length,
  interestingNetwork: jsonish.slice(0, 50).map(r => ({ url: r.url, status: r.status, contentType: r.contentType, resourceType: r.resourceType, bodySample: r.bodySample?.slice(0, 500) })),
}, null, 2));

await browser.close();
