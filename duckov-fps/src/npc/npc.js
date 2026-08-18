// NPC 實體（邏輯層，不依賴 three）：狀態機 + 行為樹 + 難度注入
// .object 由渲染層掛接（默認 null，update 為純邏輯）

import { StateMachine, NPC_STATES } from './stateMachine.js';
import { buildTree, Status } from './behaviorTree.js';

export class NPC {
  constructor(opts = {}) {
    this.id = opts.id || 'npc';
    this.hp = opts.hp ?? 100;
    this.maxHp = this.hp;
    this.visionRange = opts.visionRange ?? 40;
    this.pos = opts.pos || [0, 0, 0];
    this.target = null;          // 玩家位置 [x,y,z] 或 null
    this.fsm = new StateMachine(NPC_STATES, 'patrol');
    this.object = null;          // 渲染掛接
    // 預設行為樹：發現目標→交戰；否則巡邏
    this.tree = buildTree({
      type: 'selector', children: [
        { type: 'sequence', children: [
          { type: 'cond', id: 'seesTarget' },
          { type: 'act', id: 'toEngage' }
        ]},
        { type: 'act', id: 'toPatrol' }
      ]
    }, {
      seesTarget: (ctx) => ctx.npc.target !== null,
      toEngage: (ctx) => { ctx.npc.fsm.transition('engage'); return Status.SUCCESS; },
      toPatrol: (ctx) => { if (ctx.npc.fsm.current !== 'patrol') ctx.npc.fsm.transition('patrol'); return Status.SUCCESS; }
    });
  }

  takeDamage(d) { this.hp = Math.max(0, this.hp - d); if (this.hp === 0) this.fsm.transition('respawn'); }

  // dt 秒；engine 提供 currentDifficulty() 與玩家位置
  update(dt, engine) {
    const diff = engine.currentDifficulty ? engine.currentDifficulty() : null;
    // 視野偵測
    if (engine.playerPos) {
      const d = Math.hypot(
        engine.playerPos[0] - this.pos[0],
        engine.playerPos[1] - this.pos[1],
        engine.playerPos[2] - this.pos[2]
      );
      this.target = d <= (this.visionRange * (diff ? 1 + diff.enemyAccuracy : 1)) ? engine.playerPos : null;
    }
    this.tree.tick({ npc: this, diff });
  }
}
