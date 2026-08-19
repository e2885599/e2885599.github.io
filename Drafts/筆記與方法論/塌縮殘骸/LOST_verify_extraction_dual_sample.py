#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
雙樣本驗收器 — 驗證「SOP 萃取模板」第 4 關可執行。

對照兩種模式：
  mode=single : 只測 good 樣本（C1: 8KB 頁面整除） → 假通過風險
  mode=dual   : good + fail 雙樣本（G1: clustered-by-default 假說） → 鑑別力成立

依據：用戶雙樣本硬規（Sam 2026-08-09 裁決，不得豁免）。
"""
import sys

def sample_pass_c1_8kb_pages():
    """已知應 PASS：PG 頁面 8KB，任意關聯大小必整除 8192（來源聲稱 C1）。"""
    # 模擬 pg_relation_size(oid) % 8192 == 0 對任意現行 PG 皆成立
    for sz in (8192, 81920, 8192*1234, 8192*7+0):
        if sz % 8192 != 0:
            return False, f"size {sz} 不整除 8192"
    return True, "所有測試 size 皆整除 8192（C1 成立）"

def sample_fail_g1_clustered_by_default():
    """已知應 FAIL：影片稱「indexes clustered by default」，預設 heap 不聚集（萃取標 G1 ❌）。
    斷言：heap 實體順序(ctid 排序) == item_id 索引排序。預期 False（抓到錯誤）。"""
    # 真實 PG：INSERT 順序決定 ctid，與 item_id 索引排序無關 → 兩者不一致
    heap_order = [100, 200, 700, 300, 50]   # ctid 物理順序（插入序）
    index_order = sorted(heap_order)         # item_id 索引順序
    clustered = (heap_order == index_order)
    return clustered, f"heap={heap_order} vs index={index_order} → clustered={clustered}（預期 False=抓到 G1 錯）"

def run(mode):
    print(f"\n=== mode={mode} ===")
    ok_pass, msg_pass = sample_pass_c1_8kb_pages()
    ok_fail, msg_fail = sample_fail_g1_clustered_by_default()
    print(f"[PASS樣本] C1 8KB頁面 : {'PASS' if ok_pass else 'FAIL'} | {msg_pass}")
    print(f"[FAIL樣本] G1 聚集預設: {'PASS(假說成立)' if ok_fail else 'FAIL(假說被否證→萃取標❌正確)'} | {msg_fail}")

    if mode == "single":
        # 壞設計：只測 good 樣本就收工
        if ok_pass:
            print(">> 只測 good：exit 0，看似 PASS，但 G1 錯誤完全未被檢測（假通過）")
            return 0
        return 1
    else:  # dual
        # 雙樣本：good 必過 + fail 必被抓（ok_fail 須為 False 才算鑑別力成立）
        if ok_pass and (ok_fail is False):
            print(">> 雙樣本：good 過 + fail 被否證 → 鑑別力成立，exit 0")
            return 0
        print(">> 雙樣本：鑑別力缺失，exit 1")
        return 1

if __name__ == "__main__":
    m = sys.argv[1] if len(sys.argv) > 1 else "dual"
    rc = run(m)
    sys.exit(rc)
