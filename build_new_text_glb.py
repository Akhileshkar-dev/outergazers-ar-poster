"""
Script to rebuild assets/outergazers_text_fbx_style.glb from sources/3d/Text_cam_ref.blend
with the exact angle and orientation provided in the Blender file.
Can be executed on any machine with Blender:
  blender --background --python build_new_text_glb.py
"""

import os
import bpy
import mathutils

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BLEND_PATH = os.path.join(SCRIPT_DIR, 'sources', '3d', 'Text_cam_ref.blend')
OUTPUT_GLB = os.path.join(SCRIPT_DIR, 'assets', 'outergazers_text_fbx_style.glb')

bpy.ops.wm.open_mainfile(filepath=BLEND_PATH)

cam = bpy.data.objects['Camera']
inv_cam = cam.matrix_world.inverted()

col = bpy.data.collections['Collection']
mesh_objs = [o for o in col.objects if o.type == 'MESH']

# Calculate bounds in camera space
min_cam = [float('inf')]*3
max_cam = [float('-inf')]*3
for obj in mesh_objs:
    mw = obj.matrix_world
    for v in obj.data.vertices:
        v_cam = inv_cam @ (mw @ v.co)
        for i in range(3):
            min_cam[i] = min(min_cam[i], v_cam[i])
            max_cam[i] = max(max_cam[i], v_cam[i])

center_cam = mathutils.Vector((
    (min_cam[0] + max_cam[0]) / 2.0,
    (min_cam[1] + max_cam[1]) / 2.0,
    (min_cam[2] + max_cam[2]) / 2.0
))

print(f"Center in camera space: {center_cam}")

# Matrix to map camera space into Blender's standard coordinate system
M_cam_to_b = mathutils.Matrix([
    [1,  0,  0, 0],
    [0,  0, -1, 0],
    [0,  1,  0, 0],
    [0,  0,  0, 1]
])

T_center = mathutils.Matrix.Translation(-center_cam)
M_net = M_cam_to_b @ T_center @ inv_cam

# Ensure emission on materials for vibrant pixel colors in glTF
for mat in bpy.data.materials:
    if mat.use_nodes:
        for n in mat.node_tree.nodes:
            if n.type == 'BSDF_PRINCIPLED':
                for l in mat.node_tree.links:
                    if l.to_node == n and l.to_socket.name == 'Base Color':
                        tex_node = l.from_node
                        mat.node_tree.links.new(tex_node.outputs['Color'], n.inputs['Emission Color'])
                        if 'Emission Strength' in n.inputs:
                            n.inputs['Emission Strength'].default_value = 1.0

# Letters of OUTERGAZERS
letter_defs = [
    ('Letter_00_O', 'o.001'),
    ('Letter_01_U', 'u.001'),
    ('Letter_02_T', 't.001'),
    ('Letter_03_E', 'e.006'),
    ('Letter_04_R', 'r.004'),
    ('Letter_05_G', 'g.005'),
    ('Letter_06_A', 'a.009'),
    ('Letter_07_Z', 'z.001'),
    ('Letter_08_E', 'e.007'),
    ('Letter_09_R', 'r.005'),
    ('Letter_10_S', 's.001'),
]

final_scene = bpy.data.scenes.new("FinalExportScene")
bpy.context.window.scene = final_scene
final_col = bpy.data.collections.new("FinalCollection")
final_scene.collection.children.link(final_col)

root_obj = bpy.data.objects.new("outergazers_text_root", None)
final_col.objects.link(root_obj)
created_objects = [root_obj]

mat_og = bpy.data.materials.get('Material_1')
mat_gj = bpy.data.materials.get('Material_0')

for label, source_name in letter_defs:
    src_obj = bpy.data.objects[source_name]
    cubes = [c for c in src_obj.children_recursive if c.type == 'MESH']
    
    dupes = []
    bpy.ops.object.select_all(action='DESELECT')
    for c in cubes:
        d = c.copy()
        d.data = c.data.copy()
        final_col.objects.link(d)
        mw = c.matrix_world
        M_obj = M_net @ mw
        for v in d.data.vertices:
            v.co = M_obj @ v.co
        d.matrix_world = mathutils.Matrix.Identity(4)
        d.data.update()
        d.select_set(True)
        dupes.append(d)
    
    final_scene.view_layers[0].objects.active = dupes[0]
    bpy.ops.object.join()
    joined = final_scene.view_layers[0].objects.active
    joined.name = label
    
    if mat_og:
        joined.data.materials.clear()
        joined.data.materials.append(mat_og)
        
    min_v = [float('inf')]*3
    max_v = [float('-inf')]*3
    for v in joined.data.vertices:
        for i in range(3):
            min_v[i] = min(min_v[i], v.co[i])
            max_v[i] = max(max_v[i], v.co[i])
    center_v = mathutils.Vector(((min_v[0]+max_v[0])/2.0, (min_v[1]+max_v[1])/2.0, (min_v[2]+max_v[2])/2.0))
    
    joined.location = center_v
    for v in joined.data.vertices:
        v.co -= center_v
    joined.data.update()
    
    joined.parent = root_obj
    created_objects.append(joined)

# GAMEJAM 2026
gj_root = bpy.data.objects['gamejam_2026.003']
gj_cubes = [c for c in gj_root.children_recursive if c.type == 'MESH']
bpy.ops.object.select_all(action='DESELECT')
dupes_gj = []
for c in gj_cubes:
    d = c.copy()
    d.data = c.data.copy()
    final_col.objects.link(d)
    mw = c.matrix_world
    M_obj = M_net @ mw
    for v in d.data.vertices:
        v.co = M_obj @ v.co
    d.matrix_world = mathutils.Matrix.Identity(4)
    d.data.update()
    d.select_set(True)
    dupes_gj.append(d)

final_scene.view_layers[0].objects.active = dupes_gj[0]
bpy.ops.object.join()
joined_gj = final_scene.view_layers[0].objects.active
joined_gj.name = "Line_GameJam_2026"
if mat_gj:
    joined_gj.data.materials.clear()
    joined_gj.data.materials.append(mat_gj)

min_gj = [float('inf')]*3
max_gj = [float('-inf')]*3
for v in joined_gj.data.vertices:
    for i in range(3):
        min_gj[i] = min(min_gj[i], v.co[i])
        max_gj[i] = max(max_gj[i], v.co[i])
center_gj = mathutils.Vector(((min_gj[0]+max_gj[0])/2.0, (min_gj[1]+max_gj[1])/2.0, (min_gj[2]+max_gj[2])/2.0))
joined_gj.location = center_gj
for v in joined_gj.data.vertices:
    v.co -= center_gj
joined_gj.data.update()

joined_gj.parent = root_obj
created_objects.append(joined_gj)

# Clean out unused scenes/objects
for s in list(bpy.data.scenes):
    if s != final_scene:
        bpy.data.scenes.remove(s, do_unlink=True)

for o in list(bpy.data.objects):
    if o not in created_objects:
        bpy.data.objects.remove(o, do_unlink=True)

bpy.ops.object.select_all(action='SELECT')

bpy.ops.export_scene.gltf(
    filepath=OUTPUT_GLB,
    export_format='GLB',
    use_selection=True,
    export_apply=False
)
print("Successfully built GLB at:", OUTPUT_GLB)
