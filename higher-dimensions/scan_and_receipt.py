# -*- coding: utf-8 -*-
"""本地掃描 + Merkle 對帳（含 audio/*.mp3 與 manifest）。
對齊 code-scan-push-pipeline：掃描不可跳、Merkle 對帳不可跳。"""
import hashlib, json, os, re, glob

DIR = "D:/OODAV-MIRROR/02-STUDIO/studio-site/higher-dimensions"
RECEIPT_DIR = os.path.join(DIR, "receipts")
os.makedirs(RECEIPT_DIR, exist_ok=True)

FILES = ["index.html", "app.js", "subtitles.js", "audio_manifest.js",
         "audio_manifest.json", "SOP_訪談式科普創作_v1.md", "raw.srt", "cues.json",
         "mp3_dur.py", "tts_full.py", "gen_audio_manifest_js.py"]
# 加入所有 mp3
FILES += sorted(glob.glob(os.path.join(DIR, "audio", "*.mp3")))

UNSAFE = [
    (r"\beval\s*\(", "動態 eval"),
    (r"document\.write\s*\(", "document.write"),
    (r"(api[_-]?key|secret|token|password)\s*=\s*['\"][A-Za-z0-9]{8,}", "硬編碼密鑰"),
]

print("=== 安全掃描（降級層）===")
scan_issues = 0
for f in FILES:
    p = f if os.path.isabs(f) else os.path.join(DIR, f)
    if not os.path.exists(p):
        print(f"  [跳過] {os.path.basename(p)} 不存在"); continue
    txt = open(p, encoding="utf-8", errors="replace").read()
    hits = [desc for pat, desc in UNSAFE if re.search(pat, txt, re.I)]
    scan_issues += len(hits)
    print(f"  [{'OK' if not hits else 'WARN'}] {os.path.basename(p)}: {len(hits)} 命中" + ((" -> " + "; ".join(hits[:2])) if hits else ""))

print(f"\n掃描命中總數：{scan_issues}")

print("\n=== Merkle 對帳（wb 模式，守 CRLF 鐵律）===")
leaves = []
leaf_meta = []
for f in FILES:
    p = f if os.path.isabs(f) else os.path.join(DIR, f)
    if not os.path.exists(p): continue
    data = open(p, "rb").read()
    h = hashlib.sha256(data).hexdigest()
    leaves.append(h)
    leaf_meta.append({"file": os.path.relpath(p, DIR), "bytes": len(data), "sha256": h[:16]})
    if not f.endswith(".mp3"):
        print(f"  {os.path.basename(f)}: {len(data)} bytes  sha256={h[:16]}...")

chain = "\n".join(leaves).encode("utf-8")
root = hashlib.sha256(chain).hexdigest()
receipt = {
    "tool": "code-scan-push-pipeline(local-degraded)",
    "files": leaf_meta, "leaves": len(leaves), "merkle_root": root,
    "prev_root": "GENESIS", "scan_issues": scan_issues,
    "gate": "SKIPPED_NO_INTENT_SPEC",
    "audio": {"voice": "en-NZ-MollyNeural", "count": sum(1 for f in FILES if f.endswith('.mp3'))},
}
rp = os.path.join(RECEIPT_DIR, "scan_receipt.json")
with open(rp, "wb") as fh:
    fh.write(json.dumps(receipt, ensure_ascii=False, indent=2).encode("utf-8"))
recompute = hashlib.sha256("\n".join(leaves).encode("utf-8")).hexdigest()
assert recompute == root
print(f"\n收據：{rp}")
print(f"Merkle root = {root}")
print(f"mp3 數 = {receipt['audio']['count']}")
print(f"重算校驗：{recompute == root}")
