// Bundles src/ with esbuild and produces:
//   dist/game.js + dist/dev.html            (loads assets/ from disk - for development)
//   dist/hoshikage-chronicle.html           (ONE self-contained file: code + css + fonts + every sprite/model/sound)
import esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const entry = args.find((a) => a.startsWith('--entry='))?.split('=')[1] || 'src/main.js';
const tag = args.find((a) => a.startsWith('--name='))?.split('=')[1] || 'hoshikage-chronicle';
const noSingle = args.includes('--dev-only');
const dist = path.join(root, 'dist');
fs.mkdirSync(dist, { recursive: true });

const out = await esbuild.build({
  entryPoints: [path.join(root, entry)], bundle: true, minify: !args.includes('--no-min'), format: 'iife',
  write: false, target: 'es2021', legalComments: 'none', logLevel: 'warning', tsconfigRaw: '{}',
});
const js = out.outputFiles[0].text;
fs.writeFileSync(path.join(dist, 'game.js'), js);

const b64 = (f) => fs.readFileSync(f).toString('base64');
const fontCss = [
  ['Zen Maru Gothic', 400, 'zen-maru-gothic-latin-400-normal.woff2'],
  ['Zen Maru Gothic', 700, 'zen-maru-gothic-latin-700-normal.woff2'],
  ['Cinzel', 600, 'cinzel-latin-600-normal.woff2'],
  ['Cinzel', 700, 'cinzel-latin-700-normal.woff2'],
].map(([fam, w, f]) => `@font-face{font-family:'${fam}';font-weight:${w};font-display:block;src:url(data:font/woff2;base64,${b64(path.join(root, 'assets/fonts', f))}) format('woff2');}`).join('\n');
const css = fontCss + '\n' + fs.readFileSync(path.join(root, 'src/style.css'), 'utf8');

const shell = (body, head = '') => `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="theme-color" content="#0b0b1a"><title>Hoshikage Chronicle</title>
<style>${css}</style>${head}</head><body><canvas id="gl"></canvas><div id="ui"></div>${body}</body></html>`;

// dev page: assets from disk
fs.writeFileSync(path.join(dist, 'dev.html'), shell(`<script>window.__ASSET_BASE__='../assets/';</script><script src="game.js"></script>`));

if (!noSingle) {
  const embed = {};
  const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name);
    if (f.isDirectory()) { if (f.name !== 'fonts' && f.name !== 'LICENSES') walk(p); continue; }
    const rel = path.relative(path.join(root, 'assets'), p).split(path.sep).join('/');
    const mime = { webp: 'image/webp', png: 'image/png', glb: 'model/gltf-binary', ogg: 'audio/ogg', mp3: 'audio/mpeg', json: 'application/json' }[rel.split('.').pop()];
    embed[rel] = `data:${mime};base64,${b64(p)}`;
  } };
  walk(path.join(root, 'assets'));
  const embedJson = JSON.stringify(embed).replace(/</g, '\\u003c');
  const html = shell(`<script id="embed" type="application/json">${embedJson}</script><script>window.__EMBED__=JSON.parse(document.getElementById('embed').textContent);</script><script>${js.replace(/<\/script/gi, '<\\/script')}</script>`);
  fs.writeFileSync(path.join(dist, `${tag}.html`), html);
  console.log(`built dist/${tag}.html  ${(html.length / 1e6).toFixed(1)} MB  (${Object.keys(embed).length} embedded files)`);
}
console.log(`built dist/game.js ${(js.length / 1e3).toFixed(0)} kB`);
