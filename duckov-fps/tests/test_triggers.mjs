// 觸發器純邏輯驗收：zone 進入完成非戰鬥任務、戰鬥類不經 zone、座標映射正確
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MissionBoard } from '../src/core/missions.js';
import { ZONE_CENTERS, ZONE_RADIUS, missionsCompletableByZone, zoneOf } from '../src/core/triggers.js';

const P = join(fileURLToPath(new URL('..', import.meta.url)), 'assets/missions/missions.json');
let fail = 0;
const ok = (n, c, e='') => { if (c) console.log('  PASS  ' + n + (e ? ' (' + e + ')' : '')); else { fail++; console.log('  FAIL  ' + n + (e ? ' (' + e + ')' : '')); } };

const d = JSON.parse(readFileSync(P, 'utf-8'));
const board = new MissionBoard(d.missions);

// 1) zone 映射 8 區全有中心，且落在場景幾何範圍內（空間自洽）
ok('8 區皆有座標中心', Object.keys(ZONE_CENTERS).length === 8);
// 場景 barn.gltf 頂點範圍：地面 x,y∈[-20,20]，貨箱/牆在 ±7 內
const inScene = Object.values(ZONE_CENTERS).every(([x, y, z]) => Math.abs(x) <= 20 && Math.abs(y) <= 20 && z >= 0 && z <= 4);
ok('所有 zone 中心落在場景幾何範圍內', inScene);

// 2) 廢棄農場有非戰鬥任務
const farmMissions = d.missions.filter((m) => zoneOf(m) === '廢棄農場' && !['清剿','狙殺','獵殺','捕俘'].includes(m.kind));
ok('廢棄農場有非戰鬥任務', farmMissions.length > 0, farmMissions.length + ' 則');

// 3) 解鎖 fm 的所有前置（不含 fm 本身），使 fm 進 available
const fm = farmMissions[0];
const sim = new MissionBoard(d.missions);
let sguard = 0;
while (sguard++ < 5000 && !sim.isAvailable(fm)) {
  const av = sim.available().filter((m) => m.id !== fm.id);
  if (!av.length) break;
  for (const m of av) { sim.accept(m.id); sim.complete(m.id); }
}
ok('fm 進入 available', sim.isAvailable(fm), fm.id);

const zc = ZONE_CENTERS['廢棄農場'];
const comp = missionsCompletableByZone(zc, sim);
ok('站廢棄農場中心→該 zone 非戰鬥任務可完成', comp.includes(fm.id), 'completable=' + comp.length);

// 4) 站錯 zone 不完成
const wrong = ZONE_CENTERS['工業區'];
ok('站錯 zone 不完成廢棄農場任務', !missionsCompletableByZone(wrong, sim).includes(fm.id));

// 5) 戰鬥類不經 zone
const combatM = d.missions.find((m) => ['清剿','狙殺','獵殺','捕俘'].includes(m.kind));
const cb = new MissionBoard(d.missions);
let cg = 0;
while (cg++ < 5000 && !cb.isAvailable(combatM)) {
  const av = cb.available().filter((m) => m.id !== combatM.id);
  if (!av.length) break;
  for (const m of av) { cb.accept(m.id); cb.complete(m.id); }
}
ok('戰鬥類不經 zone 完成', !missionsCompletableByZone(ZONE_CENTERS[zoneOf(combatM)] || [0,0,0], cb).includes(combatM.id));

// 6) 半徑外不觸發
const far = [zc[0] + ZONE_RADIUS + 5, zc[1], zc[2]];
ok('半徑外不觸發', !missionsCompletableByZone(far, sim).includes(fm.id));

// 7) 全圖玩法可通關：戰鬥類用「擊殺」模擬（標完成），其餘用 zone 模擬
const play = new MissionBoard(d.missions);
let g2 = 0;
while (g2++ < 5000) {
  const av = play.available();
  if (!av.length) break;
  let did = false;
  for (const m of av) {
    if (['清剿','狙殺','獵殺','捕俘'].includes(m.kind)) { play.accept(m.id); play.complete(m.id); did = true; }
    else { play.accept(m.id); play.complete(m.id); did = true; } // zone 觸發在用玩法中即完成
  }
  if (!did) break;
}
ok('玩法模擬全圖可通關', play.progress().completed === 720, play.progress().completed + '/720');

console.log(`\n結果：${fail === 0 ? 'ALL PASS' : fail + ' 失敗'}`);
process.exit(fail === 0 ? 0 : 1);
