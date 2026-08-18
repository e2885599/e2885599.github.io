// 腳本驅動對話（純邏輯，可單測）：JSON 劇本 + 選項推進
// nodes: { id: { text, options:[{label, next}] } }

export class DialogueScript {
  constructor(nodes, start = 'start') {
    this.nodes = nodes;
    if (!nodes || !nodes[start]) throw new RangeError('對話起始節點不存在: ' + start);
    this.id = start;
  }
  current() { return this.nodes[this.id]; }
  isEnd() { const n = this.current(); return !n.options || n.options.length === 0; }
  choose(optionIndex) {
    const n = this.current();
    if (this.isEnd()) throw new RangeError('結束節點不可選擇');
    const opt = n.options[optionIndex];
    if (!opt) throw new RangeError('選項索引越界: ' + optionIndex);
    if (!this.nodes[opt.next]) throw new RangeError('跳轉目標不存在: ' + opt.next);
    this.id = opt.next;
    return this.current();
  }
}
