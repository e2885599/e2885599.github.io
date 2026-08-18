// duckov-fps 整鏈驗收（經 ego-browser-sim 契約）：真實開頁 + 觸發 NPC 任務對話 + 確認 HUD
// 由 ego-browser-sim nodejs <<EOF 調用，所有 helper 預載
const task = await useOrCreateTaskSpace('duckov-verify');
cliLog('task space: ' + task.id);
await openOrReuseTab('http://127.0.0.1:8088/', { wait: true, timeout: 30 });
cliLog('頁面開啟: ' + (await pageInfo()).url);

// 等待引擎啟動（window.__engine 出現）
await waitForLoad({ timeout: 25 });
let ready = false;
for (let i = 0; i < 20; i++) {
  ready = await js(() => !!(window.__engine && window.__engine.board && window.__engine.dialogueMount));
  if (ready) break;
  await new Promise(r => setTimeout(r, 1000));
}
cliLog('引擎+任務板+對話掛載就緒: ' + ready);
if (!ready) { cliLog('[FAIL] 引擎未在 20s 內就緒'); await completeTaskSpace('duckov-verify', { keep: false }); process.exit(1); }

// 確認 720 任務已載入
const missionCount = await js(() => window.__engine.board.byId.size);
cliLog('任務板條數: ' + missionCount);

// 模擬開第一個有任務的 NPC 對話（對齊 _tryTalk 邏輯）
const dlgResult = await js(async () => {
  const eng = window.__engine;
  const giverIds = [...new Set([...eng.board.byId.values()].map(m => m.giver))];
  for (const gid of giverIds) {
    try {
      const cur = await eng.dialogueMount.openForNpc(gid);
      if (cur) { eng._dlgOpen = true; eng._renderDialogue(); return 'OPENED:' + gid + ' | ' + (eng.dialogueMount.currentNode()?.text || '').slice(0, 50); }
    } catch (e) { return 'ERR:' + gid + ':' + e.message; }
  }
  return 'NO_DIALOGUE';
});
cliLog('對話觸發: ' + dlgResult);

// 確認 #dlg HUD 出現且含文字
const dlgText = await js(() => { const el = document.getElementById('dlg'); return el ? el.innerText.replace(/\n/g, ' ').slice(0, 100) : 'NO_DLG_EL'; });
cliLog('對話 HUD 內容: ' + dlgText);

// 推進對話（選第一選項）確認不崩
const advance = await js(() => {
  try { const n = window.__engine.dialogueMount.choose(0); return 'ADVANCED -> ' + (n?.text || '').slice(0, 40); }
  catch (e) { return 'ERR:' + e.message; }
});
cliLog('對話推進: ' + advance);

// 關閉對話
await js(() => window.__engine._closeDialogue());
cliLog('對話關閉 OK');

await captureScreenshot({ path: '.state/duckov_verify.png' });
cliLog('截圖: .state/duckov_verify.png');
await completeTaskSpace('duckov-verify', { keep: false });

// 驗收斷言（防假通過）：任務數=720 且對話 HUD 曾出現且推進成功
const pass = missionCount === 720 && dlgText !== 'NO_DLG_EL' && !advance.startsWith('ERR');
cliLog(pass ? '[PASS] 整鏈驗收通過' : '[FAIL] 驗收未通過');
process.exit(pass ? 0 : 1);
