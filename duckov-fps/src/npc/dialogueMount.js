// 任務對話掛載（純邏輯，可單測）：依 NPC 與任務板狀態選定對話樹並驅動推進
// 對齊 src/npc/dialogue.js 的 DialogueScript（nodes + options 跳轉）
import { DialogueScript } from './dialogue.js';

// 對話優先序：進行中(active) > 可完成(complete) > 可接取(accept) > 閒聊(idle)
function pickMissionState(mission, board) {
  if (board.completed.has(mission.id)) return 'complete';
  if (board.accepted.has(mission.id)) return 'active';
  if (board.isAvailable(mission)) return 'accept';
  return null;
}

export class DialogueMount {
  constructor(board, loadDialogueRef) {
    this.board = board;
    this.loadDialogueRef = loadDialogueRef; // async (relPath) => dialogueObj
    this.current = null; // { script, missionId, state }
  }

  // 依 npcId 從任務板篩出該 NPC 的任務，選最高優先序狀態，載入對應對話樹
  async openForNpc(npcId) {
    const missions = [...this.board.byId.values()].filter((m) => m.giver === npcId);
    let chosen = null;
    let chosenState = null;
    const order = ['active', 'complete', 'accept'];
    for (const st of order) {
      const hit = missions.find((m) => pickMissionState(m, this.board) === st);
      if (hit) { chosen = hit; chosenState = st; break; }
    }
    if (!chosen) {
      // 無任務：嘗試該 NPC 閒聊樹（來自 npc_*.json 的 dialogue，由 loadDialogueRef 外部提供 idle 入口）
      return null;
    }
    const ref = chosen.dialogue_ref;
    if (!ref) throw new Error('任務缺少 dialogue_ref: ' + chosen.id);
    const dlgObj = await this.loadDialogueRef(ref);
    // 對話樹依任務狀態定位起始節點：accept->start, active->active, complete->complete
    const startNode = chosenState === 'accept' ? 'start'
      : chosenState === 'active' ? 'active'
      : 'complete';
    if (!dlgObj.nodes[startNode]) throw new Error('對話樹缺起始節點: ' + startNode);
    this.current = {
      script: new DialogueScript(dlgObj.nodes, startNode),
      missionId: chosen.id,
      state: chosenState,
    };
    return this.current;
  }

  currentNode() { return this.current ? this.current.script.current() : null; }

  choose(i) {
    if (!this.current) throw new Error('無進行中對話');
    const node = this.current.script.choose(i);
    // complete 狀態選完即結案
    if (this.current.state === 'complete' && this.current.script.isEnd()) {
      this.board.complete(this.current.missionId);
    }
    return node;
  }

  close() { this.current = null; }
}
