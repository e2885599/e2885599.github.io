// 任務板（純邏輯，可單測）：載入 missions.json，依 requires 門禁派發/接取/完成
export class MissionBoard {
  constructor(missions) {
    if (!Array.isArray(missions) || missions.length === 0) throw new RangeError('missions 必須為非空陣列');
    this.byId = new Map();
    for (const m of missions) {
      if (this.byId.has(m.id)) throw new RangeError('任務 id 重複: ' + m.id);
      this.byId.set(m.id, m);
    }
    this.completed = new Set();
    this.accepted = new Set();
  }

  get(id) { return this.byId.get(id); }

  // 可接取：requires 全完成 且 本身未完成 且 未接取
  isAvailable(m) {
    return !this.completed.has(m.id) && !this.accepted.has(m.id) &&
      m.requires.every((r) => this.completed.has(r));
  }

  available() {
    return [...this.byId.values()].filter((m) => this.isAvailable(m));
  }

  accept(id) {
    const m = this.byId.get(id);
    if (!m) throw new RangeError('任務不存在: ' + id);
    if (this.completed.has(id)) throw new Error('任務已完成不可接取: ' + id);
    if (!m.requires.every((r) => this.completed.has(r))) throw new Error('前置未滿足: ' + id);
    this.accepted.add(id);
    return m;
  }

  // 完成：須已接取（或無前置的起點可直接完成）
  complete(id) {
    const m = this.byId.get(id);
    if (!m) throw new RangeError('任務不存在: ' + id);
    if (!this.accepted.has(id) && m.requires.length > 0) throw new Error('未接取且非起點: ' + id);
    this.accepted.delete(id);
    this.completed.add(id);
    return { id, kind: m.kind, reward: m.reward, reward_xp: m.reward_xp };
  }

  // 可完成的起點（無前置）：不用接取即可標完成
  completableStarts() {
    return [...this.byId.values()].filter((m) => m.requires.length === 0 && !this.completed.has(m.id));
  }

  progress() {
    return { total: this.byId.size, completed: this.completed.size, accepted: this.accepted.size };
  }
}
