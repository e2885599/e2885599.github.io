// duckov-fps 鴨子 NPC 資產驗收：確認 12 隻 duck_<role>.glb 皆為有效 glTF 且可 fetch
const task = await useOrCreateTaskSpace('duck-glb-verify');
cliLog('task: ' + task.id);
await openOrReuseTab('http://127.0.0.1:8088/', { wait: true, timeout: 30 });
const res = await js(() => {
  const roles = ['armorer','medic','mechanic','sentry','commander','comms','drill','engineer','guide','hydro','quartermaster','researcher'];
  return Promise.all(roles.map(async (r) => {
    const u = `http://127.0.0.1:8088/assets/models/duck_${r}/duck_${r}.glb`;
    try {
      const buf = await (await fetch(u)).arrayBuffer();
      const m = new Uint8Array(buf.slice(0, 4));
      const ok = m[0]===0x67 && m[1]===0x6C && m[2]===0x54 && m[3]===0x46;
      return { r, ok, size: buf.byteLength };
    } catch (e) { return { r, ok: false, err: String(e) }; }
  }));
});
let pass = 0;
for (const r of res) {
  if (r.ok && r.size > 0) { pass++; cliLog(`[OK] duck_${r.r}.glb ${r.size}b`); }
  else { cliLog(`[FAIL] duck_${r.r}: ${JSON.stringify(r).slice(0,120)}`); }
}
cliLog(`通過 ${pass}/12`);
await completeTaskSpace('duck-glb-verify', { keep: false });
process.exit(pass === 12 ? 0 : 1);
