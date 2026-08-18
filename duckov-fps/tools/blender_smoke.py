# Blender headless 冒煙測試：確認 --background --python 可執行
import bpy
import pathlib  # 記憶坑：5.2 內建 pathlib 被污染，早期崩；此處顯式觸發驗證
print("BLENDER_OK", bpy.app.version)
print("PATHLIB_OK", pathlib.Path(".").resolve())
bpy.ops.mesh.primitive_cube_add(size=1)
print("CUBE_OK objects=", len(bpy.data.objects))
