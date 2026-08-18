# 自寫 glTF 2.0 匯出（不依賴 blender 損壞的 io_scene_gltf2 addon）
# 直接從 bpy.data 讀 mesh + 材質，輸出 .gltf(.bin)。零 operator 依賴。
import bpy, json, struct, os, base64

def _mesh_world_data(obj):
    """返回 (positions[xyz...], indices[...])，套用世界矩陣"""
    import bmesh, mathutils
    bm = bmesh.new(); bm.from_mesh(obj.data); bm.transform(obj.matrix_world)
    pos = []; idx = []
    for v in bm.verts: pos.extend(v.co[:])
    for f in bm.faces:
        if len(f.verts) == 3:
            idx.extend([v.index for v in f.verts])
        else:  # 三角化
            pts = [v.index for v in f.verts]
            for i in range(1, len(pts) - 1):
                idx.extend([pts[0], pts[i], pts[i + 1]])
    bm.free()
    return pos, idx

def _base_color_of(obj):
    for slot in obj.material_slots:
        m = slot.material
        if m and m.use_nodes:
            for n in m.node_tree.nodes:
                if n.bl_idname == 'ShaderNodeBsdfPrincipled':
                    c = n.inputs.get('Base Color')
                    if c: return [round(x, 3) for x in c.default_value[:3]] + [1.0]
    return [0.8, 0.8, 0.8, 1.0]

def export_gltf(out_base):
    """out_base 不含副檔名，輸出 out_base.gltf + out_base.bin"""
    scene = bpy.context.scene
    meshes = [o for o in scene.objects if o.type == 'MESH']
    gltf = {
        "asset": {"version": "2.0", "generator": "duckov-procedural"},
        "scenes": [{"nodes": list(range(len(meshes)))}],
        "nodes": [], "meshes": [], "buffers": [], "bufferViews": [],
        "accessors": [], "materials": []
    }
    bin_blob = bytearray(); mesh_index = 0
    # 收集材質（去重以 base color）
    mat_cache = {}
    for o in meshes:
        color = _base_color_of(o)
        key = tuple(color)
        if key not in mat_cache:
            mat_cache[key] = len(gltf["materials"])
            gltf["materials"].append({
                "pbrMetallicRoughness": {
                    "baseColorFactor": list(color),
                    "metallicFactor": 0.1, "roughnessFactor": 0.7
                }
            })
        mat_idx = mat_cache[key]
        pos, idx = _mesh_world_data(o)
        # 寫 bin：positions(float32) + indices(uint32)
        pos_bytes = struct.pack('<%df' % len(pos), *pos)
        idx_bytes = struct.pack('<%dI' % len(idx), *idx)
        pos_view = len(bin_blob); bin_blob.extend(pos_bytes)
        # 4-byte 對齊
        while len(bin_blob) % 4: bin_blob.append(0)
        idx_view = len(bin_blob); bin_blob.extend(idx_bytes)
        while len(bin_blob) % 4: bin_blob.append(0)
        pos_acc = len(gltf["accessors"])
        gltf["accessors"].append({"bufferView": len(gltf["bufferViews"]), "componentType": 5126,
                                   "count": len(pos) // 3, "type": "VEC3",
                                   "min": _min3(pos), "max": _max3(pos)})
        gltf["bufferViews"].append({"buffer": 0, "byteOffset": pos_view, "byteLength": len(pos_bytes), "target": 34962})
        idx_acc = len(gltf["accessors"])
        gltf["accessors"].append({"bufferView": len(gltf["bufferViews"]), "componentType": 5125,
                                   "count": len(idx), "type": "SCALAR"})
        gltf["bufferViews"].append({"buffer": 0, "byteOffset": idx_view, "byteLength": len(idx_bytes), "target": 34963})
        gltf["meshes"].append({"primitives": [{"attributes": {"POSITION": pos_acc}, "indices": idx_acc, "material": mat_idx}]})
        gltf["nodes"].append({"mesh": mesh_index, "name": o.name})
        mesh_index += 1
    gltf["buffers"].append({"byteLength": len(bin_blob),
                             "uri": "data:application/octet-stream;base64," + base64.b64encode(bin_blob).decode('ascii')})
    # 寫檔（.gltf 自包含；.bin 另存供 splat/blend 工作區參考）
    bin_path = out_base + ".bin"
    gltf_path = out_base + ".gltf"
    with open(bin_path, 'wb') as f: f.write(bin_blob)
    with open(gltf_path, 'w', encoding='utf-8') as f:
        json.dump(gltf, f, ensure_ascii=False, indent=1)
    return gltf_path, bin_path

def _min3(flat):
    xs, ys, zs = flat[0::3], flat[1::3], flat[2::3]
    return [round(min(xs), 3), round(min(ys), 3), round(min(zs), 3)]

def _max3(flat):
    xs, ys, zs = flat[0::3], flat[1::3], flat[2::3]
    return [round(max(xs), 3), round(max(ys), 3), round(max(zs), 3)]
