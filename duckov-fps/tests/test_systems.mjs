// 綜合雙樣本驗收：武器 / 彈道 / NPC(行為樹·狀態機·對話)
import { WeaponSystem } from '../src/weapon/weapon.js';
import { projectileLanding, horizontalRange } from '../src/weapon/ballistics.js';
import { StateMachine, NPC_STATES } from '../src/npc/stateMachine.js';
import { Selector, Sequence, Condition, Action, Status, buildTree } from '../src/npc/behaviorTree.js';
import { DialogueScript } from '../src/npc/dialogue.js';

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; console.log('  PASS  ' + name); } else { fail++; console.log('  FAIL  ' + name); } }
function throws(name, fn) { let t = false; try { fn(); } catch (e) { t = true; } ok(name, t); }

console.log('— 武器系統 —');
const w = new WeaponSystem({ magSize: 5, reserve: 5, fireRate: 100, reloadTime: 1000, damage: 20 });
ok('初始彈匣=5', w.mag === 5);
const f = w.fire();
ok('開火成功', f.fired === true && w.mag === 4);
w.cooldown = 0; w.fire(); w.cooldown = 0; w.fire(); w.cooldown = 0; w.fire(); // 剩 1
w.cooldown = 0; const last = w.fire(); // 剩 0（第5發打光）
w.cooldown = 0; // 清冷卻以檢查空倉
ok('空倉開火失敗', last.fired === true && w.mag === 0 && w.fire().fired === false && w.fire().reason === 'empty');
ok('啟動裝填', w.startReload() === true);
w.tick(1.1);
ok('裝填後彈匣補滿+預備扣減', w.mag === 5 && w.reserve === 0);
ok('頭部傷害>軀幹', w.damageAt(10, 'head') > w.damageAt(10, 'torso'));
ok('近距滿傷害>遠距', w.damageAt(5) > w.damageAt(100));
throws('magSize<=0 拋錯', () => new WeaponSystem({ magSize: 0 }));
throws('未知部位拋錯', () => w.damageAt(10, 'tail'));

console.log('— 彈道 —');
const land = projectileLanding([0, 10, 0], [0, -1, 1], 20, 9.8, 0);
ok('拋射有落點與飛行時間', land && land.t > 0 && land.point.length === 3);
ok('落點 y=地面', Math.abs(land.point[1] - 0) < 1e-6);
ok('水平射程 45° 最大', horizontalRange(20, 45) > horizontalRange(20, 30));
throws('零向量方向拋錯', () => projectileLanding([0, 10, 0], [0, 0, 0], 20));
throws('仰角越界拋錯', () => horizontalRange(20, 0));

console.log('— 狀態機 —');
const sm = new StateMachine(NPC_STATES, 'patrol');
ok('初期巡邏', sm.current === 'patrol');
sm.transition('alert');
ok('巡邏→警戒', sm.current === 'alert');
sm.transition('engage');
ok('警戒→交戰', sm.current === 'engage');
throws('非法轉移 交戰→巡邏 拋錯', () => sm.transition('patrol'));
throws('不存在狀態拋錯', () => sm.transition('fly'));

console.log('— 行為樹 —');
const tree = buildTree({
  type: 'selector', children: [
    { type: 'sequence', children: [ { type: 'cond', id: 't' }, { type: 'act', id: 'hit' } ] },
    { type: 'act', id: 'miss' }
  ]
}, { t: (c) => c.seen, hit: () => Status.SUCCESS, miss: () => Status.FAILURE });
ok('條件成立→序列成功', tree.tick({ seen: true }) === Status.SUCCESS);
ok('條件不成立→降選擇器下一支', tree.tick({ seen: false }) === Status.FAILURE);
throws('未知節點拋錯', () => buildTree({ type: 'x' }));
throws('空 Selector 拋錯', () => new Selector([]));

console.log('— 腳本對話 —');
const dlg = new DialogueScript({
  start: { text: '你是誰？', options: [ { label: '我是逃脫者', next: 'b' } ] },
  b: { text: '歡迎來到鴨科夫。', options: [] }
}, 'start');
ok('初始節點文字正確', dlg.current().text.includes('你是誰'));
ok('未達結束', dlg.isEnd() === false);
dlg.choose(0);
ok('選項推進到 b', dlg.current().text.includes('鴨科夫'));
ok('b 為結束節點', dlg.isEnd() === true);
throws('結束節點選擇拋錯', () => dlg.choose(0));
throws('選項越界拋錯', () => new DialogueScript({ start: { text: 'x', options: [] } }).choose(5));

console.log(`\n結果：${pass} 通過 / ${fail} 失敗`);
process.exit(fail === 0 ? 0 : 1);
