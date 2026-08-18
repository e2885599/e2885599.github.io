# Blender 統一資產生產：程序化生成 武器/角色/場景模組 → 自寫 glTF + splat 多視角
# 注意：Blender 5.2 背景 export_scene.gltf / export_scene.obj 均靜默失敗（addon 依賴損壞）
#       → 改用 tools/blender_gltf_writer.py 自寫 glTF 2.0 匯出（零 operator 依賴）
# 用法：blender --background --python tools/blender_assets.py
import bpy, os, math, sys, mathutils

try:
    bpy.ops.preferences.addon_enable(module='io_scene_gltf2')
except Exception as e:
    print('WARN addon:', e)

# 自寫 glTF writer（與本腳本同目錄）
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from blender_gltf_writer import export_gltf

OUT = "D:/OODAV-MIRROR/02-STUDIO/duckov-fps/assets"
for d in ("weapons", "characters", "scenes", "splat_train"):
    os.makedirs(OUT + "/" + d, exist_ok=True)

def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

def pbr_mat(name, color, metal=0.1, rough=0.7, emis=(0,0,0)):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.bl_idname == 'ShaderNodeBsdfPrincipled')
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Metallic"].default_value = metal
    bsdf.inputs["Roughness"].default_value = rough
    if any(emis):
        bsdf.inputs["Emission Color"].default_value = (*emis, 1.0)
        bsdf.inputs["Emission Strength"].default_value = 2.0
    return m

def make_weapon():
    clear_scene()
    bpy.ops.mesh.primitive_cube_add(size=1, scale=(0.18, 0.18, 1.1))
    gun = bpy.context.object; gun.name = "GunBody"
    gun.data.materials.append(pbr_mat("GunMat", (0.15,0.16,0.2), metal=0.8, rough=0.35))
    bpy.ops.mesh.primitive_cylinder_add(radius=0.05, depth=0.6, rotation=(math.pi/2,0,0), location=(0,0,0.8))
    barrel = bpy.context.object; barrel.name = "Barrel"
    barrel.data.materials.append(pbr_mat("BarrelMat", (0.05,0.05,0.08), metal=0.9, rough=0.2))
    bpy.ops.mesh.primitive_ico_sphere_add(radius=0.09, location=(0,0.12,0.1))
    core = bpy.context.object; core.name = "EnergyCore"
    core.data.materials.append(pbr_mat("CoreMat", (0,0,0), emis=(0.1,0.8,1.0)))
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.join()
    out = OUT + "/weapons/raygun"
    g, b = export_gltf(out)
    return g, os.path.getsize(g), os.path.getsize(b)

def make_character():
    clear_scene()
    bpy.ops.mesh.primitive_cube_add(size=1, scale=(0.6,0.9,0.4), location=(0,0,1.0))
    torso = bpy.context.object; torso.name = "Torso"
    torso.data.materials.append(pbr_mat("DuckMat", (0.2,0.5,0.35), rough=0.6))
    bpy.ops.mesh.primitive_ico_sphere_add(radius=0.35, location=(0,0,1.7))
    head = bpy.context.object; head.name = "Head"
    head.data.materials.append(pbr_mat("DuckMat", (0.2,0.5,0.35), rough=0.6))
    bpy.ops.mesh.primitive_cone_add(radius1=0.18, radius2=0.0, depth=0.4, rotation=(math.pi/2,0,0), location=(0,0.2,2.0))
    beak = bpy.context.object; beak.name = "Beak"
    beak.data.materials.append(pbr_mat("BeakMat", (0.8,0.6,0.1), rough=0.5))
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.join()
    char = bpy.context.object; char.name = "DuckKovEnemy"
    out = OUT + "/characters/duckkov_enemy"
    g, b = export_gltf(out)
    return g, os.path.getsize(g), os.path.getsize(b)

def make_scene_and_splat_views(n_views=36, radius=12, height=4):
    clear_scene()
    bpy.ops.mesh.primitive_plane_add(size=40, location=(0,0,0))
    floor = bpy.context.object; floor.name = "Floor"
    floor.data.materials.append(pbr_mat("FloorMat", (0.25,0.22,0.18), rough=0.95))
    walls = [(0,0,2,0,0,0,10,4,0.3),(5,0,2,0,0,math.pi/2,10,4,0.3),
             (0,5,2,math.pi/2,0,0,10,4,0.3),(-5,0,2,0,0,-math.pi/2,10,4,0.3)]
    for (lx,ly,lz,rx,ry,rz,sx,sy,sz) in walls:
        bpy.ops.mesh.primitive_cube_add(size=1, scale=(sx,sy,sz), location=(lx,ly,lz), rotation=(rx,ry,rz))
        bpy.context.object.data.materials.append(pbr_mat("WallMat", (0.4,0.4,0.42), rough=0.9))
    for k in range(6):
        a = k/6*2*math.pi
        bpy.ops.mesh.primitive_cube_add(size=1.4, location=(math.cos(a)*5, math.sin(a)*5, 0.7))
        bpy.context.object.data.materials.append(pbr_mat("CrateMat", (0.5,0.35,0.15), rough=0.8))
    # 存 .blend 兜底（背景可靠）
    blend = OUT + "/scenes/barn.blend"
    bpy.ops.wm.save_as_mainfile(filepath=blend)
    # 自寫 glTF
    out = OUT + "/scenes/barn"
    g, b = export_gltf(out)
    # 多視角渲染（splat 訓練集，不經壞 operator）
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.image_settings.file_format = 'PNG'
    scene.render.resolution_x = 1024; scene.render.resolution_y = 768
    cam = bpy.data.cameras.new("SplatCam"); cam_obj = bpy.data.objects.new("SplatCam", cam)
    scene.collection.objects.link(cam_obj)
    scene.camera = cam_obj  # 設為場景活動攝影機（否則 render 報無攝影機）
    saved = 0
    for i in range(n_views):
        ang = i/n_views*2*math.pi
        cam_obj.location = (math.cos(ang)*radius, math.sin(ang)*radius, height)
        # Blender 無 look_at：用 to_track_quat 讓相機 -Z 指向原點
        target = mathutils.Vector((0,0,2))
        direction = target - cam_obj.location
        cam_obj.rotation_mode = 'QUATERNION'
        cam_obj.rotation_quaternion = direction.to_track_quat('-Z', 'Y')
        cam_obj.rotation_mode = 'XYZ'
        scene.render.filepath = f"{OUT}/splat_train/barn_{i:03d}.png"
        bpy.ops.render.render(write_still=True)
        saved += 1
    return g, os.path.getsize(g), os.path.getsize(b), saved

if __name__ == "__main__":
    g, gs, bs = make_weapon(); print("WEAPON", g, "gltf", gs, "bin", bs)
    c, cs, cb = make_character(); print("CHAR", c, "gltf", cs, "bin", cb)
    s, ss, sb, n = make_scene_and_splat_views(); print("SCENE", s, "gltf", ss, "bin", sb, "VIEWS", n)
    print("ASSETS_DONE")
