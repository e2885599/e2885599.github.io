// 有限狀態機（純邏輯，可單測）：巡邏/警戒/交戰/撤退/重生
// 非法轉移拋錯（驗證鑑別力）

export const NPC_STATES = {
  patrol:  { transitions: ['alert'] },
  alert:   { transitions: ['patrol', 'engage', 'retreat'] },
  engage:  { transitions: ['alert', 'retreat', 'respawn'] },
  retreat: { transitions: ['engage', 'patrol', 'respawn'] },
  respawn: { transitions: ['patrol'] }
};

export class StateMachine {
  constructor(states = NPC_STATES, initial = 'patrol') {
    this.states = states;
    if (!this.states[initial]) throw new RangeError('初始狀態不存在: ' + initial);
    this.current = initial;
  }
  can(to) { return this.states[this.current].transitions.includes(to); }
  transition(to) {
    if (!this.states[to]) throw new RangeError('目標狀態不存在: ' + to);
    if (!this.can(to)) throw new RangeError(`非法轉移: ${this.current} → ${to}`);
    this.current = to;
    return this.current;
  }
}
