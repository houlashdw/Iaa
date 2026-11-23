// Usage: node tools/shot.mjs <url> <out.png> [waitMs] [evalJs]  -- headless Chromium screenshot with WebGL (SwiftShader)
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(process.env.NODE_PATH + '/playwright')); }
const [url, out, wait = '3000', evalJs] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(url);
await page.waitForTimeout(Number(wait));
if (evalJs) { const r = await page.evaluate(evalJs); console.log('eval:', JSON.stringify(r)); }
await page.screenshot({ path: out });
console.log(logs.slice(-15).join('\n'));
await browser.close();
