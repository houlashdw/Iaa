import { boot } from './game.js';
boot().catch((e) => { console.error('BOOT ERROR', e); const d = document.createElement('pre'); d.style.cssText = 'position:fixed;inset:0;color:#fff;background:#300;padding:20px;z-index:999;white-space:pre-wrap'; d.textContent = 'Boot error:\n' + (e.stack || e); document.body.appendChild(d); });
