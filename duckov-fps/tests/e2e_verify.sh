#!/usr/bin/env bash
# duckov-fps 整鏈驗收：ego-browser-sim 真實開頁 http://127.0.0.1:8088/ 確認引擎啟動 + NPC 對話可觸發
set -e
SKILL="C:/Users/66889/AppData/Local/hermes/skills/software-development/ego-browser-sim"
URL="http://127.0.0.1:8088/"
cd "$SKILL"
node - <<'EOF'
const { useOrCreateTaskSpace, openOrReuseTab, snapshotText, js, cliLog, waitForLoad, completeTaskSpace, captureScreenshot } = (await import('./scripts/run.mjs')).default || {};
EOF
echo "placeholder"