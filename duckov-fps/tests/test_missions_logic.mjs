// 任務板純邏輯驗收：依 requires 門禁、接取/完成、進度
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MissionBoard } from '../src/core/missions.js';

const P = join(fileURLToPath(new URL('..', import.meta.url)), 'assets/missions/missions.json');
let fail = 0;
const ok = (n, c, e='') => { if (c) console.log('  PASS  ' + n + (e ? ' (' + e + ')' : '')); else { fail++; console.log('  FAIL  ' + n + (e ? ' (' + e + ')' : '')); } };

const d = JSON.parse(readFileSync(P, 'utf-8'));
const board = new MissionBoard(d.missions);
ok('載入 720 則', board.byId.size === 720, board.byId.size + '');

// 起點可接取
const starts = board.available().filter((m) => m.requires.length === 0);
ok('起點任務可接取', starts.length > 0, starts.length + ' 個');
const s0 = starts[0];
board.accept(s0.id);
ok('接取後不在 available', !board.isAvailable(s0));

// 門禁：隨取一個有前置的任務，未完成前置前不可接取
const locked = d.missions.find((m) => m.requires.length > 0);
let threw = false;
try { board.accept(locked.id); } catch { threw = true; }
ok('前置未滿足拒絕接取', threw);

// 完成起點後，依賴它的任務解鎖
board.complete(s0.id);
// 找依賴 s0 的任務
const dep = d.missions.find((m) => m.requires.includes(s0.id));
ok('完成前置後依賴任務變可接取', dep ? board.isAvailable(dep) : true, dep ? dep.id : 'n/a');

// 完成反例：未接取的非起點不可完成
let threw2 = false;
try { board.complete(locked.id); } catch { threw2 = true; }
ok('未接取非起點拒絕完成', threw2);

// 進度統計
const pr = board.progress();
ok('進度統計正確', pr.total === 720 && pr.completed === 1 && pr.accepted === 0, JSON.stringify(pr));

// 全圖可完成性模擬：依拓撲逐個完成（證明可通關）
const sim = new MissionBoard(d.missions);
let guard = 0;
while (sim.available().length && guard < 5000) {
  const av = sim.available()[0];
  sim.accept(av.id); sim.complete(av.id); guard++;
}
ok('全圖可通關（所有任務可完成）', sim.progress().completed === 720, sim.progress().completed + '/720');

console.log(`\n結果：${fail === 0 ? 'ALL PASS' : fail + ' 失敗'}`);
process.exit(fail === 0 ? 0 : 1);
