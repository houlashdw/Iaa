// Story smoke test: jumps into every scripted scene and lets an auto-confirm bot play it (enemy HP is shrunk by a cheat).
// usage: node tools/story-test.mjs [url] [scenario-substring]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(process.env.NODE_PATH + '/playwright')); }
const url = process.argv[2] || 'http://127.0.0.1:8765/dist/dev.html';
const only = process.argv[3];
const P4 = "['haru','airi','ren','daigo']", P4Z = "['haru','airi','ren','zeno']";
const room = (map, i, dz = 0, dx = 0) => `(()=>{const c=__G.field.def.grid.centers[${i}]; __G.field.teleportParty(c[0]+${dx}, c[1]+${dz}, 'up'); })()`;
const S = [
  { name: 'prologue', setup: `__G.cheat={hp:60,atk:3}; __G.input.stack.length=0; __G.newGame()`, then: `__G.field.teleportParty(23.5,21,'up')`, wait: 150, done: `__G.state.flags.prologue && __G.mode==='field' && __G.field.def.id==='hinode' && !__G.field.busy` },
  { name: 'woods_airi', setup: `__G.debugStart('woods1',13.5,22,{party:['haru'],lv:2})`, then: `__G.field.teleportParty(13.5,17,'up')`, done: `__G.state.flags.airi_joined && !__G.field.busy && __G.mode==='field'` },
  { name: 'woods_boss', setup: `__G.debugStart('woods2',17.5,20,{party:['haru','airi'],lv:5,flags:{airi_joined:1}})`, then: `__G.field.teleportParty(17.5,13.5,'up')`, done: `__G.state.flags.ch1_done && !__G.field.busy` },
  { name: 'shrine_ren', setup: `__G.debugStart('shrine',22.5,41,{party:['haru','airi'],lv:6,flags:{ch1_done:1}})`, then: `__G.field.teleportParty(22.5,38,'up')`, done: `__G.state.flags.ren_joined && !__G.field.busy` },
  { name: 'shrine_boss', setup: `__G.debugStart('shrine',22.5,24,{party:${P4},lv:9,flags:{ch1_done:1,ren_joined:1}})`, then: `__G.field.teleportParty(22.5,17.4,'up')`, done: `__G.state.flags.ch2_done && !__G.field.busy` },
  { name: 'port_daigo', setup: `__G.debugStart('namiji',10,22.5,{party:['haru','airi','ren'],lv:10,flags:{ch2_done:1,ren_joined:1}})`, then: `__G.field.teleportParty(17,22,'right')`, done: `__G.state.flags.daigo_joined && !__G.field.busy` },
  { name: 'lighthouse_boss', setup: `__G.debugStart('lighthouse',11.5,31,{party:${P4},lv:12,flags:{daigo_joined:1,ren_joined:1}})`, then: `__G.field.teleportParty(12,10.2,'up')`, done: `__G.state.flags.ch3_done && !__G.field.busy` },
  { name: 'cave_sylva', setup: `__G.debugStart('cavern1',6.5,30.5,{party:${P4},lv:14,flags:{daigo_joined:1,ren_joined:1}})`, then: room('cavern1', 1, 0), done: `__G.state.flags.sylva_found && !__G.field.busy` },
  { name: 'cave_mordo', setup: `__G.debugStart('cavern1',6.5,30.5,{party:${P4},lv:15,flags:{daigo_joined:1,ren_joined:1,sylva_found:1}})`, then: room('cavern1', 6, 2.4), done: `__G.state.flags.mordo_dead && !__G.field.busy` },
  { name: 'cave_stheno', setup: `__G.debugStart('cavern2',7,31,{party:${P4},lv:16,flags:{daigo_joined:1,ren_joined:1,sylva_found:1,mordo_dead:1}})`, then: room('cavern2', 6, 2.4), done: `__G.state.flags.ch4_done && __G.state.flags.shard4 && !__G.field.busy` },
  { name: 'castle_zeno', setup: `__G.debugStart('castle1',22,34,{party:${P4},lv:19,flags:{daigo_joined:1,ren_joined:1,sylva_found:1,ch4_done:1}})`, then: room('castle1', 1, -0.6), done: `__G.state.flags.zeno_joined && !__G.field.busy` },
  { name: 'castle_vael', setup: `__G.debugStart('castle1',22,34,{party:${P4Z},lv:20,flags:{daigo_joined:1,ren_joined:1,sylva_found:1,ch4_done:1,zeno_joined:1}})`, then: room('castle1', 3, 5), done: `__G.state.flags.vael_dead && !__G.field.busy` },
  { name: 'castle_kazan', setup: `__G.debugStart('castle2',20,34,{party:${P4Z},lv:22,flags:{ren_joined:1,vael_dead:1,zeno_joined:1}})`, then: room('castle2', 3, 5), done: `__G.state.flags.kazan_dead && !__G.field.busy` },
  { name: 'final', cheat: { hp: 3000, atk: 8 }, setup: `__G.debugStart('throne',15,20,{party:${P4Z},lv:24,flags:{ren_joined:1,zeno_joined:1,kazan_dead:1}})`, then: `__G.field.teleportParty(15,13.4,'up')`, wait: 1000, done: `__G.state.flags.game_complete && __G.mode==='title'` },
];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
let fails = 0;
for (const sc of S) {
  if (only && !sc.name.includes(only)) continue;
  const page = await browser.newPage({ viewport: { width: 480, height: 270 }, deviceScaleFactor: 1 });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  const t0 = Date.now();
  await page.goto(url);
  await page.waitForFunction('window.__G && window.__G.title && window.__G.mode==="title"', null, { timeout: 60000 });
  await page.evaluate(`__G.gfx.setQuality('low')`);
  await page.evaluate(`__G.cheat=${JSON.stringify({ auto: true, ...(sc.cheat || { hp: 40, atk: 40 }) })}; __G.speed=${sc.speed || 10}`);
  await page.evaluate(sc.setup);
  await page.waitForTimeout(2500);
  await page.evaluate(`window.__auto=setInterval(()=>{try{__G.input._dispatch('ok')}catch(e){}},90)`);
  await page.evaluate(sc.then);
  let ok = false; const limit = (sc.wait || 90) * 1000;
  let lastDbg = 0;
  while (Date.now() - t0 < limit) {
    if (await page.evaluate(sc.done).catch(() => false)) { ok = true; break; }
    if (process.env.DBG && Date.now() - lastDbg > 10000) { lastDbg = Date.now(); console.log('   ..', ((Date.now() - t0) / 1000).toFixed(0) + 's', await page.evaluate(`(()=>{const F=__G.field,cb=F.combat;return JSON.stringify({sc:!!cb.scripted,eng:cb.engaged,modal:__G.input.modal,tele:cb.vfx.tele.length,party:cb.party.map(x=>[x.name,Math.round(x.hp),+x.actor.position.x.toFixed(1),+x.actor.position.z.toFixed(1),x.act&&x.act.type,+x.thinkCd.toFixed(1),x.stuckTot&&+x.stuckTot.toFixed(1),x.actor.moving,x.hitstun,x.stun,x.actor.ai]),foes:cb.mobs.map(m=>[m.alive,Math.round(m.hp),+m.actor.position.x.toFixed(1),+m.actor.position.z.toFixed(1),m.act&&m.act.type,m.engaged]),t:+cb.time.toFixed(1)})})()`).catch((e) => String(e))); }
    await page.waitForTimeout(500);
  }
  const flags = await page.evaluate(`JSON.stringify({mode:__G.mode, map:__G.field.def&&__G.field.def.id, lv:__G.state.roster.haru&&__G.state.roster.haru.lv, busy:__G.field.busy})`).catch(() => '?');
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${sc.name.padEnd(16)} ${((Date.now() - t0) / 1000).toFixed(0).padStart(3)}s  ${flags}${errs.length ? '  ERRORS: ' + [...new Set(errs)].slice(0, 3).join(' | ') : ''}`);
  if (!ok || errs.length) fails++;
  if (!ok) { await page.screenshot({ path: `/tmp/story_fail_${sc.name}.png` }); console.log('   state:', await page.evaluate(`(()=>{const F=__G.field,cb=F.combat;return JSON.stringify({scripted:!!cb.scripted,engaged:cb.engaged,modal:__G.input.modal,ev:cb.eventBusy,res:cb.resultBusy,party:cb.party.map(x=>[x.name,Math.round(x.hp),+x.actor.position.x.toFixed(1),+x.actor.position.z.toFixed(1),x.act&&x.act.type]),foes:cb.mobs.map(m=>[m.name,m.alive,Math.round(m.hp),+m.actor.position.x.toFixed(1),+m.actor.position.z.toFixed(1),m.act&&m.act.type,m.engaged]),time:+cb.time.toFixed(1)})})()`).catch((e) => String(e))); }
  await page.close();
}
await browser.close();
console.log(fails ? `${fails} scenario(s) failed` : 'ALL SCENARIOS PASSED');
process.exit(fails ? 1 : 0);
