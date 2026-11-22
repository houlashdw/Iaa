// Сборка: бандлит src/main.js (Three.js внутри) и вшивает в один index.html (открывается двойным кликом).
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
const out = await build({ entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', target: 'es2020', write: false, tsconfigRaw: '{}', legalComments: 'none' });
const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const tpl = readFileSync('src/index.template.html', 'utf8');
writeFileSync('index.html', tpl.replace('/*BUNDLE*/', () => js));
console.log('index.html:', (js.length / 1024).toFixed(0), 'KB bundle');
