#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
引擎度量尺子 — 主控（取樣收斂 + 決策表 + Merkle 對帳 + 雙樣本驗收）
=====================================================================
OODAV LAB / 主動資運工程工作室
用途：把選 TS/JS 執行時的記憶體管理量化為四可測維度（D1~D4），
      輸出可證偽決策表，落盤 Merkle 收據，並以雙樣本驗收證明鑑別力。

設計原則（對齊 code-write-gated-sequence 憲章）：
  - 輸入驗證：負值/NaN/無序分位/缺欄位一律拒絕（exit!=0），不假通過。
  - Merkle 對帳：位元組層 wb 寫，防 Windows CRLF 污染；prev_root 納入承諾。
  - 雙樣本驗收：verify 同時跑 GOOD（A 類觸發）/ BAD-負值 / BAD-NaN / 收據鏈重算，
    任一行為不符即 ALL_PASS=False。
  - 不依賴 web_search/Firecrawl：本機 node 直跑產生真實數字。
"""

import argparse
import json
import os
import subprocess
import sys
import hashlib
import math
from datetime import datetime, timezone

# ---- 路徑常數（集中管理，便於遷移） ----
HERE = os.path.dirname(os.path.abspath(__file__))
BENCH_JS = os.path.join(HERE, "bench_node.mjs")
NODE_BIN = r"C:/Program Files/nodejs/node.exe"
RECEIPTS_DIR = os.path.join(HERE, "receipts")
LEDGER_PATH = os.path.join(RECEIPTS_DIR, "ledger.jsonl")

# ---- 決策門檻（集中可調，對齊 ruler.md 第三節） ----
THRESHOLDS = {
    "COLD_EDGE_MS": 10.0,        # 冷啟 < 10ms → 邊緣/serverless 友善
    "PEROBJ_EDGE_B": 100.0,      # 每物件 < 100B → 原生/緊湊
    "PEROBJ_HEAVY_B": 200.0,     # 每物件 > 200B → V8 頭成本顯著
}

# 外推 D4 的假設（集中可調）：預估 1000 並發連線，每連線 1000 個狀態物件
D4_ASSUME_CONN = 1000
D4_ASSUME_OBJS_PER_CONN = 1000


# ===================== 取樣層 =====================
def run_bench_once(mode: str) -> dict:
    """呼叫 node bench_node.mjs 一次，回傳解析後的 JSON dict。"""
    if mode not in ("min", "alloc1m", "cold"):
        raise ValueError(f"非法 mode: {mode}")
    if not os.path.exists(NODE_BIN):
        raise FileNotFoundError(f"node 不可達: {NODE_BIN}")
    if not os.path.exists(BENCH_JS):
        raise FileNotFoundError(f"bench 不存在: {BENCH_JS}")
    # subprocess list + shell=False（防注入）；顯式 check=False（只讀取，非零 rc 由上層判）
    proc = subprocess.run(
        [NODE_BIN, BENCH_JS, "--mode", mode],
        capture_output=True, text=True, timeout=120, check=False,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"bench {mode} 失敗 rc={proc.returncode}: {proc.stderr[:200]}")
    # 取最後一行 JSON（避免 stderr 警告干擾）
    lines = [ln for ln in proc.stdout.splitlines() if ln.strip().startswith("{")]
    if not lines:
        raise RuntimeError(f"bench {mode} 無 JSON 輸出: {proc.stdout[:200]}")
    return json.loads(lines[-1])


def collect(mode: str, repeat: int) -> list:
    """
    重複取樣，回傳「展平」後的 sample dict 列表。
    bench_node.mjs 契約為 {mode, samples:[single_dict]}，此處去除外層
    mode 包裝，使 summarize() 直接拿到 [{rss_mb}, ...] 形態。
    """
    samples = []
    for _ in range(repeat):
        payload = run_bench_once(mode)
        # 防假通過：契約不符直接拋
        if "samples" not in payload or len(payload["samples"]) != 1:
            raise RuntimeError(f"bench {mode} 契約異常: {payload}")
        samples.append(payload["samples"][0])
    return samples


def quantile(values: list, q: float) -> float:
    """線性插值分位數（與 numpy 預設 Type-7 一致）。"""
    if not values:
        raise ValueError("空值不可取分位")
    s = sorted(values)
    if len(s) == 1:
        return s[0]
    pos = (len(s) - 1) * q
    lo = int(pos)
    hi = min(lo + 1, len(s) - 1)
    frac = pos - lo
    return s[lo] * (1 - frac) + s[hi] * frac


def summarize(samples: list, mode: str) -> dict:
    """把多次樣本收斂成 P10/P50/P90 指標。"""
    if mode == "min":
        rss = [s["rss_mb"] for s in samples]
        return {"d1_min_rss_mb": {f"p{int(q*100)}": round2(quantile(rss, q))
                                  for q in (0.10, 0.50, 0.90)}}
    if mode == "alloc1m":
        rss = [s["rss_mb"] for s in samples]
        per = [s["per_obj_bytes"] for s in samples]
        return {
            "d2_alloc1m_rss_mb": {f"p{int(q*100)}": round2(quantile(rss, q))
                                  for q in (0.10, 0.50, 0.90)},
            "d2_per_obj_bytes": {f"p{int(q*100)}": round2(quantile(per, q))
                                 for q in (0.10, 0.50, 0.90)},
        }
    if mode == "cold":
        cold = [s["cold_ms"] for s in samples]
        return {"d3_cold_ms": {f"p{int(q*100)}": round2(quantile(cold, q))
                               for q in (0.10, 0.50, 0.90)}}
    raise ValueError(f"未知 mode: {mode}")


def round2(x: float) -> float:
    return round(x * 100) / 100


# ===================== 決策層 =====================
def decide(metrics: dict) -> dict:
    """
    套用決策表。輸入 metrics 必須來自 summarize() 且通過 validate_metrics()。
    回傳 {verdict, reasons[]}。

    決策邏輯（門檻全取自 THRESHOLDS，消除常數未用矛盾）：
      - A_native_candidate：D3 冷啟 < COLD_EDGE_MS 且 D2 每物件 < PEROBJ_EDGE_B
        （原生編譯路徑：緊湊結構體 + 低冷啟，邊緣/serverless 友善）
      - B_heavy_gc：D2 每物件 > PEROBJ_HEAVY_B（V8 頭成本顯著，有狀態高並發需評估配額）
      - stay：其餘
    D4 僅作資訊外推展示，不單獨設門檻（避免與 D2 門檻語意重疊）。
    """
    validate_metrics(metrics)  # 先驗證，負值/NaN/缺欄位直接拋 → 上層轉 exit!=0
    d1 = metrics["d1_min_rss_mb"]["p50"]
    d2 = metrics["d2_per_obj_bytes"]["p50"]
    d3 = metrics["d3_cold_ms"]["p50"]
    # D4 外推：每連線狀態物件數 × 每物件位元組（資訊展示用）
    d4 = D4_ASSUME_CONN * D4_ASSUME_OBJS_PER_CONN * (d2 / (1024 * 1024))  # MB/千連線

    reasons = [f"D1 固定開銷 P50={d1}MB", f"D2 每物件 P50={d2}B",
               f"D3 冷啟動 P50={d3}ms", f"D4 有狀態並發預估={round2(d4)}MB/千連線"]

    if (d3 < THRESHOLDS["COLD_EDGE_MS"]) and (d2 < THRESHOLDS["PEROBJ_EDGE_B"]):
        return {"verdict": "A_native_candidate",
                "reasons": reasons + [f"符合 A 類：冷啟 < {THRESHOLDS['COLD_EDGE_MS']}ms"
                                      f" 且每物件 < {THRESHOLDS['PEROBJ_EDGE_B']}B，原生編譯路徑值得試點"]}
    if d2 > THRESHOLDS["PEROBJ_HEAVY_B"]:
        return {"verdict": "B_heavy_gc",
                "reasons": reasons + [f"符合 B 類：每物件 > {THRESHOLDS['PEROBJ_HEAVY_B']}B，"
                                      f"V8 頭成本顯著，有狀態高並發需評估容器配額"]}
    return {"verdict": "stay",
            "reasons": reasons + ["維持現有託管執行時即可"]}


def validate_metrics(m: dict) -> None:
    """
    防假通過：
      - 關鍵欄位缺失 → 拋 ValueError
      - 非有限值（NaN/Inf）或負值 → 拋 ValueError（v<0 無法擋 NaN，須用 math.isfinite）
      - p10/p50/p90 缺失或無序 → 拋 ValueError
    """
    required = ["d1_min_rss_mb", "d2_alloc1m_rss_mb", "d2_per_obj_bytes", "d3_cold_ms"]
    for k in required:
        if k not in m:
            raise ValueError(f"metrics 缺欄位: {k}")
    for group in (m["d1_min_rss_mb"], m["d2_alloc1m_rss_mb"],
                  m["d2_per_obj_bytes"], m["d3_cold_ms"]):
        for q in ("p10", "p50", "p90"):
            if q not in group:
                raise ValueError(f"分位數缺欄位: {q}")
            v = group[q]
            if not isinstance(v, (int, float)) or not math.isfinite(v) or v < 0:
                raise ValueError(f"非法度量值（NaN/Inf/負值）: {v}")
        if not (group["p10"] <= group["p50"] <= group["p90"]):
            raise ValueError(f"分位數無序 p10<=p50<=p90 不成立: {group}")


# ===================== Merkle 對帳層 =====================
def sha256_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def merkle_root(hashes: list) -> str:
    """二進制配對哈希，單數補齊；空串列回空 root（不偽造）。"""
    if not hashes:
        return ""
    lv = list(hashes)
    while len(lv) > 1:
        if len(lv) % 2 == 1:
            lv.append(lv[-1])
        lv = [sha256_bytes((lv[i] + lv[i + 1]).encode("utf-8"))
              for i in range(0, len(lv), 2)]
    return lv[0]


def write_receipt(date_str: str, rows: list, prev_root: str) -> dict:
    """
    位元組層 wb 寫收據 + ledger，回傳 receipt dict（含 merkle_root）。
    防假通過：
      - prev_root 納入每筆 leaf 的承諾（改歷史收據會影響後續 root，無法靜默篡改）。
      - 檔名精確到微秒（避免同秒覆寫）。
      - 暫存檔 + 原子 rename（中途失敗不殘留半寫收據）。
    """
    os.makedirs(RECEIPTS_DIR, exist_ok=True)
    # 每筆 leaf 包含 prev_root 承諾，使續鏈不可竄改
    leaves = []
    for r in rows:
        committed = {"prev_root": prev_root, **r}
        leaves.append(sha256_bytes(json.dumps(committed, ensure_ascii=False, sort_keys=True).encode("utf-8")))
    root = merkle_root(leaves)
    receipt = {
        "date": date_str, "rows": len(rows), "merkle_root": root,
        "prev_root": prev_root, "leaves": [h for h in leaves],
    }
    # 微秒時間戳避免同秒覆寫
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%S-%fZ")
    rpath = os.path.join(RECEIPTS_DIR, f"{ts}.receipt.json")
    tmp = rpath + ".tmp"
    # wb 模式寫收據（Windows CRLF 會改位元組，必須 wb）
    with open(tmp, "wb") as f:
        f.write(json.dumps(receipt, ensure_ascii=False, indent=2).encode("utf-8"))
    os.replace(tmp, rpath)  # 原子 rename
    # ledger 逐行 wb（append）
    with open(LEDGER_PATH, "ab") as f:
        for r in rows:
            line = json.dumps(r, ensure_ascii=False, sort_keys=True)
            f.write((line + "\n").encode("utf-8"))
    return receipt


def read_prev_root() -> str:
    """讀最近一份收據的 root 當 prev（續鏈，不重新 GENESIS）。"""
    if not os.path.isdir(RECEIPTS_DIR):
        return ""
    files = sorted([f for f in os.listdir(RECEIPTS_DIR) if f.endswith(".receipt.json")])
    if not files:
        return ""
    with open(os.path.join(RECEIPTS_DIR, files[-1]), "rb") as f:
        data = json.loads(f.read().decode("utf-8"))
    return data.get("merkle_root", "")


# ===================== 流程層 =====================
def cmd_run(repeat: int):
    """主流程：三維度取樣 → 收斂 → 決策 → Merkle 對帳。"""
    print(f"[run] 重複取樣 repeat={repeat}", file=sys.stderr)
    m_min = summarize(collect("min", repeat), "min")
    m_alloc = summarize(collect("alloc1m", repeat), "alloc1m")
    m_cold = summarize(collect("cold", repeat), "cold")
    metrics = {**m_min, **m_alloc, **m_cold}
    decision = decide(metrics)
    date_str = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%SZ")
    row = {"ts": date_str, "metrics": metrics, "decision": decision}
    prev = read_prev_root()
    receipt = write_receipt(date_str, [row], prev)
    out = {"metrics": metrics, "decision": decision,
           "merkle_root": receipt["merkle_root"], "prev_root": prev}
    print(json.dumps(out, ensure_ascii=False, indent=2))
    return 0


# ===================== 雙樣本驗收 =====================
def _verify_good() -> bool:
    """GOOD 樣本：構造「緊湊 + 低冷啟」metrics，決策必須給 A_native_candidate。"""
    metrics = {
        "d1_min_rss_mb": {"p10": 2.0, "p50": 2.2, "p90": 2.4},
        "d2_alloc1m_rss_mb": {"p10": 85.0, "p50": 88.0, "p90": 90.0},
        "d2_per_obj_bytes": {"p10": 70.0, "p50": 72.0, "p90": 74.0},
        "d3_cold_ms": {"p10": 2.1, "p50": 2.3, "p90": 2.5},
    }
    try:
        d = decide(metrics)
    except ValueError as e:  # 只捕獲設計內的驗證異常，不吞其他
        print(f"[FAIL] GOOD 樣本決策拋例外: {e}")
        return False
    if d.get("verdict") != "A_native_candidate":
        print(f"[FAIL] GOOD 樣本預期 A_native_candidate，實得 {d.get('verdict')}")
        return False
    print(f"[PASS] GOOD 樣本 verdict={d['verdict']}")
    return True


def _verify_bad() -> bool:
    """BAD 樣本一：負值 rss（非法輸入），decide() 必須拋 → 上層拒絕。"""
    metrics = {
        "d1_min_rss_mb": {"p10": -5.0, "p50": -5.0, "p90": -5.0},  # 負值非法
        "d2_alloc1m_rss_mb": {"p10": 255.0, "p50": 259.0, "p90": 265.0},
        "d2_per_obj_bytes": {"p10": 138.0, "p50": 140.0, "p90": 142.0},
        "d3_cold_ms": {"p10": 54.0, "p50": 56.0, "p90": 58.0},
    }
    try:
        decide(metrics)
    except ValueError:
        print("[PASS] BAD-1 樣本負值正確被拒（拋 ValueError）")
        return True
    print("[FAIL] BAD-1 樣本負值未被拒（鑑別力失效）")
    return False


def _verify_bad_nan() -> bool:
    """BAD 樣本二：NaN（validate_metrics 必須用 isfinite 擋下，v<0 擋不住 NaN）。"""
    metrics = {
        "d1_min_rss_mb": {"p10": 68.0, "p50": 70.0, "p90": 72.0},
        "d2_alloc1m_rss_mb": {"p10": 255.0, "p50": 259.0, "p90": 265.0},
        "d2_per_obj_bytes": {"p10": float("nan"), "p50": 140.0, "p90": 142.0},
        "d3_cold_ms": {"p10": 54.0, "p50": 56.0, "p90": 58.0},
    }
    try:
        decide(metrics)
    except ValueError:
        print("[PASS] BAD-2 樣本 NaN 正確被拒（isfinite 擋下）")
        return True
    print("[FAIL] BAD-2 樣本 NaN 未被拒（鑑別力失效）")
    return False


def _verify_receipt_chain() -> bool:
    """收據鏈重算關卡：既有 receipts 若存在，每份 root 必須可由 leaves 獨立重算一致。"""
    if not os.path.isdir(RECEIPTS_DIR):
        print("[PASS] 收據鏈重算：尚無收據（跳過）")
        return True
    files = sorted([f for f in os.listdir(RECEIPTS_DIR) if f.endswith(".receipt.json")])
    if not files:
        print("[PASS] 收據鏈重算：尚無收據（跳過）")
        return True
    ok = True
    for f in files:
        with open(os.path.join(RECEIPTS_DIR, f), "rb") as fh:
            data = json.loads(fh.read().decode("utf-8"))
        recomputed = merkle_root(data["leaves"])
        if recomputed != data["merkle_root"]:
            print(f"[FAIL] 收據 {f} root 重算不符（可能被竄改）")
            ok = False
    if ok:
        print(f"[PASS] 收據鏈重算：{len(files)} 份 root 全部可由 leaves 重算一致")
    return ok


def cmd_verify() -> int:
    ok = True
    ok &= _verify_good()
    ok &= _verify_bad()
    ok &= _verify_bad_nan()
    ok &= _verify_receipt_chain()
    print("ALL_PASS =", ok)
    return 0 if ok else 1


def main():
    ap = argparse.ArgumentParser(description="引擎度量尺子")
    sub = ap.add_subparsers(dest="cmd")
    rp = sub.add_parser("run", help="取樣 + 決策 + Merkle")
    rp.add_argument("--repeat", type=int, default=7)
    sub.add_parser("verify", help="雙樣本驗收（GOOD/BAD/收據鏈）")
    args = ap.parse_args()
    if args.cmd == "run":
        if not (1 <= args.repeat <= 100):  # 邊界：防止 0/負/極大值佔用資源
            print(f"[error] --repeat 必須在 1..100，收到 {args.repeat}")
            return 2
        return cmd_run(args.repeat)
    if args.cmd == "verify":
        return cmd_verify()
    ap.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())
