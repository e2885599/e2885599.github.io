#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""portal-game-3d · C 路徑 L1+L2 管線：單關 lightMap GI 烘焙（對齊 cg-block L2-D）。

讀 levels.json 某關 → 用 bmesh 重建靜態 Box（wall/door/floor，對齊 VSCALE 垂直比例）
→ Smart UV Project（紋理 UV）+ 複製到 uv2（lightMap UV）
→ Cycles 烘焙 Combined（含間接光/陰影 = 真·單次反彈 GI）
→ 輸出 level_<ID>_lightmap.png + 收據（sha256 + 解析度 + 引擎 + 物件數）。

映射對齊 engine.js：
  WORLD_W=900, WORLD_D=600, WALL_H_REF=220, WALL_H_TARGET=90, VSCALE=90/220
  地板 y=0 頂面在 y=4（BoxGeometry(W,8,D) 中心 y=0 → 頂 4）；本腳本地板 Box 中心設 y=-4 使頂面貼 y=0
  wall 中心 y=wh/2（wh=h*VSCALE），與 engine 的 mesh.position.set(..., wh/2, ...) 一致

呼叫（Blender 會吞 argv，用環境變數傳參）：
  set I2L_LEVELS=levels/levels.json
  set I2L_INDEX=0
  set I2L_OUT=lightmaps
  "D:/OODAV-3D/tools/blender/blender-5.2.0-windows-x64/blender.exe" --background --python scripts/bake_level_lightmap.py
"""

from __future__ import annotations
import os
import sys
import json
import hashlib

try:
    import bpy  # type: ignore
    import bmesh  # type: ignore
except ImportError:
    bpy = None


# 對齊 engine.js 常數
WORLD_W = 900
WORLD_D = 600
WALL_H_REF = 220
WALL_H_TARGET = 90
VSCALE = WALL_H_TARGET / WALL_H_REF


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for c in iter(lambda: f.read(65536), b""):
            h.update(c)
    return h.hexdigest()


def build_static_boxes(level):
    """回傳 list[(name, x, y, z, w, h, d)] 世界座標中心 + 尺寸。

    對齊 engine._buildLevel：
      floor: Box(W,8,D) at (W/2, 0, D/2) → 本腳本中心 y=-4 使頂面貼 y=0
      wall:  Box(w, wh, d) at (x+w/2, wh/2, z+d/2), wh=h*VSCALE
      door:  Box(w, dh, d) at (x+w/2, dh/2, z+d/2), dh=(dr.h||220)*VSCALE
    靜態件 = floor + walls + doors（不含 hazard 岩漿、box 可推、player 動態）
    """
    boxes = []
    # 地板
    boxes.append(("floor", WORLD_W / 2, -4, WORLD_D / 2, WORLD_W, 8, WORLD_D))
    for w in level.get("walls", []):
        wh = (w.get("h") or WALL_H_REF) * VSCALE
        boxes.append(("wall", w["x"] + w["w"] / 2, wh / 2, w["z"] + w["d"] / 2,
                      w["w"], wh, w["d"]))
    for dr in level.get("doors", []):
        dh = (dr.get("h") or WALL_H_REF) * VSCALE
        boxes.append(("door", dr["x"] + dr["w"] / 2, dh / 2, dr["z"] + dr["d"] / 2,
                      dr["w"], dh, dr["d"]))
    return boxes


def add_box(name, cx, cy, cz, w, h, d):
    """建 Box mesh + 物件，回傳 obj（已設 uv2=uv 拷貝）。"""
    bpy.ops.mesh.primitive_cube_add(size=1, location=(cx, cy, cz))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (w, h, d)   # Blender 5.2 Object.scale 是 Vector，無 .set()；直接用 tuple 賦值
    # 確保有 uv（cube 預設有 uv channel 0）；複製到 uv2 供 lightMap
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    # Smart UV Project（紋理 UV，channel 0）
    bpy.ops.uv.smart_project(angle_limit=66.0, island_margin=0.02)
    bpy.ops.object.mode_set(mode='OBJECT')
    # 複製 uv → uv2
    me = obj.data
    if me.uv_layers.get("uv2") is None:
        me.uv_layers.new(name="uv2")
    # bmesh 拷貝
    bm = bmesh.new()
    bm.from_mesh(me)
    uv0 = bm.loops.layers.uv[0]
    uv2 = bm.loops.layers.uv["uv2"]
    for face in bm.faces:
        for loop in face.loops:
            loop[uv2].uv = loop[uv0].uv
    bm.to_mesh(me)
    bm.free()
    return obj


def main():
    if bpy is None:
        print("ERROR: 須在 Blender --background --python 內執行")
        sys.exit(2)

    levels_path = os.environ.get("I2L_LEVELS", "levels/levels.json")
    index = int(os.environ.get("I2L_INDEX", "0"))
    out = os.environ.get("I2L_OUT", "lightmaps")
    res = int(os.environ.get("I2L_RES", "1024"))   # lightMap 解析度 2^n

    # 啟用 cycles（背景啟動未自動載入）
    try:
        bpy.ops.preferences.addon_enable(module="cycles")
    except Exception as e:
        print("WARN: enable cycles 失敗", e)

    with open(levels_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    level = data["levels"][index]
    level_id = level.get("id", f"L{index+1}")

    # 清空場景
    bpy.ops.wm.read_factory_settings(use_empty=True)
    # 重新啟用 cycles（read_factory 會重設）
    try:
        bpy.ops.preferences.addon_enable(module="cycles")
    except Exception:
        pass
    # 空場景無 world → 先建 world（bake/環境光需要）
    if bpy.context.scene.world is None:
        bpy.context.scene.world = bpy.data.worlds.new("World")

    # 建靜態幾何
    boxes = build_static_boxes(level)
    objs = [add_box(n, *b) for n, *b in boxes]

    # 燈光：主光（投影）+ 環境（讓 GI 有入射能量，否則間接反彈無來源 → lightMap 全黑）
    bpy.context.scene.world.use_nodes = True
    # 環境：世界背景設中等亮度灰，提供間接光反彈來源（GI 核心）
    wtree = bpy.context.scene.world.node_tree
    bg = wtree.nodes.get("Background")
    if bg is None:
        bg = wtree.nodes.new("ShaderNodeBackground")
        wtree.links.new(bg.outputs["Background"], wtree.nodes["World Output"].inputs["Surface"])
    bg.inputs["Color"].default_value = (0.6, 0.65, 0.75, 1.0)   # 天空灰藍環境
    bg.inputs["Strength"].default_value = 1.5
    # 主光
    light_data = bpy.data.lights.new("KeyLight", type="SUN")
    light_data.energy = 6.0
    light_obj = bpy.data.objects.new("KeyLight", light_data)
    bpy.context.collection.objects.link(light_obj)
    light_obj.location = (WORLD_W * 0.6, WALL_H_TARGET * 6, WORLD_D * 0.4)
    light_obj.rotation_euler = (0, 0, 0)

    # 選所有靜態物件準備 bake
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]

    # 渲染設定：Cycles + 烘焙
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.bake_type = "COMBINED"
    sc.cycles.samples = 64          # 原型採樣（快）；全做時可升 128/256
    sc.cycles.max_bounces = 4       # 含間接反彈（真 GI）
    sc.render.resolution_x = res
    sc.render.resolution_y = res
    sc.render.bake.margin = 4        # UV 島邊緣留白
    sc.render.bake.use_clear = True
    sc.render.bake.target = "IMAGE_TEXTURES"
    sc.render.bake.use_pass_direct = True
    sc.render.bake.use_pass_indirect = True   # 間接光 = GI 核心

    # 建目標圖（lightMap）
    os.makedirs(out, exist_ok=True)
    img_name = f"level_{level_id}_lightmap"
    img = bpy.data.images.new(img_name, width=res, height=res)
    img.filepath_raw = os.path.join(out, f"{img_name}.png")
    img.file_format = "PNG"

    # 每個物件建一個材質掛 Image Texture（bake 目標）
    for o in objs:
        mat = bpy.data.materials.new(f"{o.name}_bakemat")
        mat.use_nodes = True
        # 輸出節點
        out_node = mat.node_tree.nodes.new("ShaderNodeOutputMaterial")
        # 用 emission 接收 bake（combined bake 寫入任意表面）
        bsdf = mat.node_tree.nodes.new("ShaderNodeBsdfDiffuse")
        mat.node_tree.links.new(bsdf.outputs["BSDF"], out_node.inputs["Surface"])
        # 貼圖節點（bake 目標）
        tex = mat.node_tree.nodes.new("ShaderNodeTexImage")
        tex.image = img
        mat.node_tree.nodes.active = tex   # bake 寫入 active image
        o.data.materials.clear()
        o.data.materials.append(mat)

    # 執行 bake
    bpy.ops.object.bake(type="COMBINED")

    # 儲存圖
    img.save_render(filepath=img.filepath_raw)

    # 收據
    receipt = {
        "tool": "portal-game-3d/bake_level_lightmap.py",
        "blender": ".".join(str(x) for x in bpy.app.version),
        "engine": "CYCLES",
        "level": level_id,
        "params": {"resolution": res, "samples": 64, "max_bounces": 4,
                   "n_static_objects": len(objs)},
        "lightmap": {
            "path": img.filepath_raw,
            "sha256": sha256_file(img.filepath_raw),
            "resolution": f"{res}x{res}",
        },
    }
    rcpt_path = os.path.join(out, f"{img_name}.receipt.json")
    with open(rcpt_path, "w", encoding="utf-8") as f:
        f.write(json.dumps(receipt, ensure_ascii=False, indent=2))

    print(f"I2L_BAKE_OK level={level_id} objs={len(objs)} "
          f"png={img.filepath_raw} sha256={receipt['lightmap']['sha256'][:16]}...")


if __name__ == "__main__":
    main()
