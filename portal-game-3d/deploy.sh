#!/usr/bin/env bash
# portal-game-3d GitHub Pages 部署腳本（子路徑：e2885599.github.io/portal-game-3d/）
# 憑證：從環境變數 GITHUB_TOKEN 讀取（本機不回顯、不入 git）；用後請於 GitHub 撤銷。
# 用法（在 studio-site 目錄下）：GITHUB_TOKEN=ghp_xxx bash portal-game-3d/deploy.sh
set -euo pipefail
REPO="e2885599/e2885599.github.io"
BRANCH="main"
MSG="deploy: portal-game-3d WebGPU+TSL 重建版（含 TSL 材質/HUD/可通性驗證/動量守恆單測）"
TOKEN="${GITHUB_TOKEN:-${GITHUB_CLASSIC_TOKEN:-}}"
if [ -z "$TOKEN" ]; then
  echo "[FAIL] 未設定 GITHUB_TOKEN。請先 export GITHUB_TOKEN= 或 source .env" >&2
  exit 1
fi
echo "[INFO] 推送 portal-game-3d 到 $REPO@$BRANCH"
git -C "$(dirname "$0")/.." push "https://x-access-token:${TOKEN}@github.com/${REPO}.git" "$BRANCH"
echo "[OK] 推送完成 → https://e2885599.github.io/portal-game-3d/"
