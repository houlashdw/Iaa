// Scripted playtest: node tools/play.mjs <url> <out-prefix> "wait 2000" "key Enter" "hold ArrowUp 800" "shot name" "eval <js>" ...
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(process.env.NODE_PATH + '/playwright')); }
const [url, prefix, ...steps] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const logs = [];
page.on('console', (m) => { const t = m.text(); if (!/GPU stall|GL Driver/.test(t)) logs.push(`[${m.type()}] ${t}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${(e.stack || '').split('\n').slice(0, 4).join('\n')}`));
await page.goto(url);
for (const s of steps) {
  const i = s.indexOf(' '); const cmd = i < 0 ? s : s.slice(0, i), arg = i < 0 ? '' : s.slice(i + 1);
  if (cmd === 'wait') await page.waitForTimeout(Number(arg));
  else if (cmd === 'key') await page.keyboard.press(arg);
  else if (cmd === 'hold') { const [k, ms] = arg.split(' '); await page.keyboard.down(k); await page.waitForTimeout(Number(ms)); await page.keyboard.up(k); }
  else if (cmd === 'mash') { const [k, n, d] = arg.split(' '); for (let j = 0; j < Number(n); j++) { await page.keyboard.press(k); await page.waitForTimeout(Number(d)); } }
  else if (cmd === 'shot') await page.screenshot({ path: `${prefix}_${arg}.png` });
  else if (cmd === 'click') { const [x, y] = arg.split(' ').map(Number); await page.mouse.click(x, y); }
  else if (cmd === 'eval') { try { const r = await page.evaluate(arg); if (r !== undefined) console.log('eval>', JSON.stringify(r)); } catch (e) { console.log('eval ERR', e.message); } }
  else if (cmd === 'until') { // until <js> <timeoutMs>
    const [js, to] = arg.split(' ||| '); const t0 = Date.now();
    while (Date.now() - t0 < Number(to || 20000)) { if (await page.evaluate(js)) break; await page.waitForTimeout(200); }
  }
}
console.log(logs.slice(-25).join('\n'));
await browser.close();
