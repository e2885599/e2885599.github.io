# OODAV LAB 專屬信箱啟用 SOP（路徑 B：oodav-lab.tw + Google Workspace）

> 狀態：2026-08-05 啟動。網域 `oodav-lab.tw` 經三重查證為 **Non-existent domain**（whois "No Found"、8.8.8.8 權威回報不存在、本機解析失敗），故需先註冊。
> 代管者定位：網域自持（註冊商處持有）、郵件基礎設施用 Google Workspace（您是管理員，Google 僅為基礎設施，非內容代管者）。
> 角色分工：需真人動作（付款/綁卡/KYC/Console 開關）由用戶執行；agent 僅協助腳本自動化與本地憑證化。

---

## 🗓️ 開通時間與校驗追蹤（手動填寫，agent 會在提醒 cron 中回報）
| 項目 | 預計/實際時間 | 狀態 | 校驗方式 |
|------|--------------|------|----------|
| 網域註冊 oodav-lab.tw | ____ | ☐ 未開始 ☐ 進行中 ☐ 完成 | whois/8.8.8.8 解析得到 NS |
| Google Workspace 開通 | ____ | ☐ 未開始 ☐ 進行中 ☐ 完成 | Workspace 控制台顯示啟用 |
| MX 生效 | ____ | ☐ 未開始 ☐ 進行中 ☐ 完成 | `nslookup -type=MX oodav-lab.tw 8.8.8.8` 出 Google MX |
| studio@ 收信實測 | ____ | ☐ 未開始 ☐ 進行中 ☐ 完成 | 外部信箱寄到 studio@oodav-lab.tw 成功收到 |
| 官網 mailto 切回正式 | ____ | ☐ 未開始 ☐ 進行中 ☐ 完成 | contact.html 含 mailto:studio@oodav-lab.tw 且無「籌備中」 |

> 提醒 cron：job `b896ecd74b87`（每 2 天）。本地 CLI 無即時投遞，輸出存於 cron 列表；請在該 job 觸發後回報 agent 執行校驗。

---

## 📥 下一版郵箱（過渡期可收信入口）
- **需求**：一個「現在就能收信」的個人信箱（如 Gmail / Outlook），當過渡期對外聯絡入口。
- **狀態**：⏳ 待用戶提供。
- **agent 動作（收到後）**：把官網 contact.html 的「籌備中」區塊改為可點 `mailto:<過渡信箱>`，先確保「能收信」；待 studio@oodav-lab.tw 開通並實測收信成功，再切回正式 mailto 並移除過渡標註。
- **為何需要**：在網域與 Workspace 開通前，官網不能留 ghost mailto，但也不能完全無入口；過渡信箱是「可證偽的可收信入口」。

---

## 階段 0：準備（現在就能做，免費）
1. 準備一個**目前已能收信**的個人信箱當「管理員信箱」（如您的 Gmail/Outlook）。
   - 理由：Google Workspace 註冊時會把驗證碼寄到這裡，因為 `studio@oodav-lab.tw` 還沒生出來。
2. 準備可付款的信用卡（Workspace 約 NT$ 170/使用者/月，首年常有優惠）。
3. 把這個「管理員信箱」告訴 agent，agent 會把官網聯絡頁的 mailto 先接上它（過渡期可收信）。

## 階段 1：註冊網域 oodav-lab.tw（需真人付款）
1. 選台灣 TWNIC 認證註冊商，擇一：
   - Gandi（gandi.net，介面友善，含免費 DNS）
   - PChome 買網域（domains.pchome.com.tw）
   - Hinet 網域（domain.hinet.net）
2. 搜尋 `oodav-lab.tw` → 確認可註冊（預期可註冊，因目前不存在）→ 完成付款（約 NT$ 300–500/年）。
3. 註冊商後台把 **Nameserver** 設為下列 Google Workspace 提供的值（或暫用註冊商 DNS 並手動加 MX）：
   - 若用 Google Workspace 自帶 DNS：依 Workspace 啟用精靈指示設 NS。
   - 一般 MX（Workspace 標準）為：
     `1 ASPMX.L.GOOGLE.COM`、`5 ALT1.ASPMX.L.GOOGLE.COM`、`5 ALT2.ASPMX.L.GOOGLE.COM`、`10 ALT3.ASPMX.L.GOOGLE.COM`、`10 ALT4.ASPMX.L.GOOGLE.COM`（實際值以 Workspace 控制台顯示為準）。

## 階段 2：開 Google Workspace（需真人綁卡/KYC）
1. 前往 https://workspace.google.com/  → 開始試用（通常 14 天）。
2.  business name 填 `OODAV LAB`（或您登記名稱）。
3.  網域填 `oodav-lab.tw`。
4.  管理員帳號建 `admin@oodav-lab.tw`（或先用個人信箱收驗證碼，再綁定網域）。
5.  綁卡完成訂閱。
6.  依控制台「啟用網域」精靈設 MX（複製它給的確切值，不要手打錯）。

## 階段 3：建立 studio@oodav-lab.tw
1.  Workspace 控制台 → 使用者 → 建立使用者 `studio`，主要郵件 `studio@oodav-lab.tw`。
2.  可再加別名： `contact@`、`hello@` 都轉給 studio。
3.  等 MX 生效（DNS 傳播通常 5 分鐘–24 小時）。

## 階段 4：agent 自動化（免真人）
1.  agent 用 `nslookup -type=MX` 驗證 MX 生效。
2.  agent 對 `studio@oodav-lab.tw` 發一封測試信確認可收（或由用戶從外部信箱實測）。
3.  agent 把官網 `contact.html` 的 mailto 從「籌備中」改回 `mailto:studio@oodav-lab.tw` 並移除「籌備中」標註。
4.  agent 重新 push 到 GitHub Pages，等待重建。

## 階段 5：可證偽驗收（agent 執行）
- [ ] `nslookup -type=MX oodav-lab.tw 8.8.8.8` 出現 Google MX 記錄
- [ ] 從外部信箱寄 `studio@oodav-lab.tw` 成功收到（或 Google 管理員端可見收件）
- [ ] 官網 contact 頁 mailto 可點、文字無「籌備中」
- [ ] 公網 curl 確認 contact.html 含 `mailto:studio@oodav-lab.tw`

---

## 費用估算（年）
- 網域：NT$ 300–500
- Workspace：NT$ 170 × 12 ≈ NT$ 2,040（單使用者；首年常有折扣）
- 合計約 NT$ 2,500/年

## 風險與對策
- 網域被別人搶註：盡快完成階段 1。
- MX 設錯導致收不到信：階段 5 用外部信實測收信才算過。
- Workspace 試用到期未綁卡：試用結束前完成綁卡，否則帳號停用。

1. 準備一個**目前已能收信**的個人信箱當「管理員信箱」（如您的 Gmail/Outlook）。
   - 理由：Google Workspace 註冊時會把驗證碼寄到這裡，因為 `studio@oodav-lab.tw` 還沒生出來。
2. 準備可付款的信用卡（Workspace 約 NT$ 170/使用者/月，首年常有優惠）。
3. 把這個「管理員信箱」告訴 agent，agent 會把官網聯絡頁的 mailto 先接上它（過渡期可收信）。

## 階段 1：註冊網域 oodav-lab.tw（需真人付款）
1. 選台灣 TWNIC 認證註冊商，擇一：
   - Gandi（gandi.net，介面友善，含免費 DNS）
   - PChome 買網域（domains.pchome.com.tw）
   - Hinet 網域（domain.hinet.net）
2. 搜尋 `oodav-lab.tw` → 確認可註冊（預期可註冊，因目前不存在）→ 完成付款（約 NT$ 300–500/年）。
3. 註冊商後台把 **Nameserver** 設為下列 Google Workspace 提供的值（或暫用註冊商 DNS 並手動加 MX）：
   - 若用 Google Workspace 自帶 DNS：依 Workspace 啟用精靈指示設 NS。
   - 一般 MX（Workspace 標準）為：`ASPXNS1.****.PROD.OUTLOOK.COM` 不適用；Google 的為：
     `smtp.google.com` 的 MX 記錄：`1 ASPMX.L.GOOGLE.COM`、`5 ALT1.ASPMX.L.GOOGLE.COM`、`5 ALT2.ASPMX.L.GOOGLE.COM`、`10 ALT3.ASPMX.L.GOOGLE.COM`、`10 ALT4.ASPMX.L.GOOGLE.COM`（實際值以 Workspace 控制台顯示為準）。

## 階段 2：開 Google Workspace（需真人綁卡/KYC）
1. 前往 https://workspace.google.com/  → 開始試用（通常 14 天）。
2.  business name 填 `OODAV LAB`（或您登記名稱）。
3.  網域填 `oodav-lab.tw`。
4.  管理員帳號建 `admin@oodav-lab.tw`（或先用個人信箱收驗證碼，再綁定網域）。
5.  綁卡完成訂閱。
6.  依控制台「啟用網域」精靈設 MX（複製它給的確切值，不要手打錯）。

## 階段 3：建立 studio@oodav-lab.tw
1.  Workspace 控制台 → 使用者 → 建立使用者 `studio`，主要郵件 `studio@oodav-lab.tw`。
2.  可再加別名： `contact@`、`hello@` 都轉給 studio。
3.  等 MX 生效（DNS 傳播通常 5 分鐘–24 小時）。

## 階段 4：agent 自動化（免真人）
1.  agent 用 `dig`/線上工具驗證 MX 生效、對 `studio@oodav-lab.tw` 發一封測試信確認可收。
2.  agent 把官網 `contact.html` 的 mailto 從「籌備中」改回 `mailto:studio@oodav-lab.tw` 並移除「籌備中」標註。
3.  agent 重新 push 到 GitHub Pages，等待重建。

## 階段 5：可證偽驗收（agent 執行）
- [ ] `dig MX oodav-lab.tw` 出現 Google MX 記錄
- [ ] 從外部信箱寄 `studio@oodav-lab.tw` 成功收到（或 Google 管理員端可見收件）
- [ ] 官網 contact 頁 mailto 可點、文字無「籌備中」
- [ ] 公網 curl 確認 contact.html 含 `mailto:studio@oodav-lab.tw`

---

## 費用估算（年）
- 網域：NT$ 300–500
- Workspace：NT$ 170 × 12 ≈ NT$ 2,040（單使用者；首年常有折扣）
- 合計約 NT$ 2,500/年

## 風險與對策
- 網域被別人搶註：盡快完成階段 1。
- MX 設錯導致收不到信：階段 5 用外部信實測收信才算過。
- Workspace 試用到期未綁卡：試用結束前完成綁卡，否則帳號停用。
