// 行為樹（純邏輯，可單測）：選擇器/序列/裝飾器/條件/動作
// 狀態碼：SUCCESS / FAILURE / RUNNING

export const Status = { SUCCESS: 'success', FAILURE: 'failure', RUNNING: 'running' };

export class Selector {
  constructor(children) { if (!children.length) throw new RangeError('Selector 需至少一個子節點'); this.children = children; }
  tick(ctx) {
    for (const c of this.children) {
      const r = c.tick(ctx);
      if (r === Status.SUCCESS || r === Status.RUNNING) return r;
    }
    return Status.FAILURE;
  }
}

export class Sequence {
  constructor(children) { if (!children.length) throw new RangeError('Sequence 需至少一個子節點'); this.children = children; }
  tick(ctx) {
    for (const c of this.children) {
      const r = c.tick(ctx);
      if (r === Status.FAILURE || r === Status.RUNNING) return r;
    }
    return Status.SUCCESS;
  }
}

export class Condition {
  constructor(fn) { if (typeof fn !== 'function') throw new RangeError('Condition 須傳入函式'); this.fn = fn; }
  tick(ctx) { return this.fn(ctx) ? Status.SUCCESS : Status.FAILURE; }
}

export class Action {
  constructor(fn) { if (typeof fn !== 'function') throw new RangeError('Action 須傳入函式'); this.fn = fn; }
  tick(ctx) { return this.fn(ctx); }
}

export function buildTree(spec, leafFns) {
  // spec: { type:'selector'|'sequence', children:[...] } 或 { type:'cond'|'act', id }
  if (spec.type === 'selector' || spec.type === 'sequence') {
    const Node = spec.type === 'selector' ? Selector : Sequence;
    return new Node(spec.children.map((c) => buildTree(c, leafFns)));
  }
  if (spec.type === 'cond') return new Condition(leafFns[spec.id]);
  if (spec.type === 'act') return new Action(leafFns[spec.id]);
  throw new RangeError('未知節點類型: ' + spec.type);
}
