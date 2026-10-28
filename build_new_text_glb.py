"""
Script to rebuild assets/outergazers_text_fbx_style.glb from D:\NEW TEXTURES\model2.gltf
preserving the 11 animated letter nodes and the 'outergazers_text_reveal' animation clip.
"""

import bpy

bpy.ops.wm.read_factory_settings(use_empty=True)

# 1. Import bak (has animation and the 11 Letter nodes)
bpy.ops.import_scene.gltf(filepath=r'c:\Users\akhil\OneDrive\Desktop\webar-prototype-outergazers\assets\outergazers_text_fbx_style.glb.bak')

# 2. Import model2.gltf
bpy.ops.import_scene.gltf(filepath=r'D:\NEW TEXTURES\model2.gltf')

letters = [
    ('Letter_00_O', 'o', 10.0),
    ('Letter_01_U', 'u', 8.0),
    ('Letter_02_T', 't', 6.0),
    ('Letter_03_E', 'e.002', 4.0),
    ('Letter_04_R', 'r.001', 2.0),
    ('Letter_05_G', 'g.002', 0.0),
    ('Letter_06_A', 'a.004', -2.0),
    ('Letter_07_Z', 'z', -4.0),
    ('Letter_08_E', 'e.003', -6.0),
    ('Letter_09_R', 'r.002', -8.0),
    ('Letter_10_S', 's', -10.0),
]

s_x = 0.35
s_y = 0.35 * (0.72 / 1.25)
s_z = 0.35 * (0.72 / 1.80)

y_center = 0.0
z_center = 1.1875

mat_model2 = bpy.data.materials.get('Material_1')

for target_name, source_name, x_center in letters:
    target_obj = bpy.data.objects.get(target_name)
    source_obj = bpy.data.objects.get(source_name)
    
    cubes = [c for c in source_obj.children if c.type == 'MESH']
    
    bpy.ops.object.select_all(action='DESELECT')
    for c in cubes:
        c.select_set(True)
    bpy.context.view_layer.objects.active = cubes[0]
    bpy.ops.object.duplicate()
    bpy.ops.object.join()
    joined = bpy.context.active_object
    
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    
    mesh = joined.data
    for v in mesh.vertices:
        x_raw, y_raw, z_raw = v.co.x, v.co.y, v.co.z
        v.co.x = -(x_raw - x_center) * s_x
        v.co.y = (z_raw - z_center) * s_y
        v.co.z = (y_raw - y_center) * s_z
        
    mesh.update()
    
    mesh.materials.clear()
    if mat_model2:
        mesh.materials.append(mat_model2)
        
    old_mesh = target_obj.data
    target_obj.data = mesh
    bpy.data.objects.remove(joined, do_unlink=True)
    if old_mesh:
        bpy.data.meshes.remove(old_mesh, do_unlink=True)

# Delete all objects from model2 so only Letter_XX objects remain
for obj in list(bpy.data.objects):
    if not obj.name.startswith('Letter_'):
        bpy.data.objects.remove(obj, do_unlink=True)

# Export to assets/outergazers_text_fbx_style.glb
out_path = r'c:\Users\akhil\OneDrive\Desktop\webar-prototype-outergazers\assets\outergazers_text_fbx_style.glb'
bpy.ops.export_scene.gltf(
    filepath=out_path,
    export_format='GLB',
    export_animations=True,
    export_current_frame=False,
    export_apply=False
)
print('Successfully exported GLB to:', out_path)
