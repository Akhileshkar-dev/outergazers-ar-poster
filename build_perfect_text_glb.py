import os
import math
import bpy
import mathutils

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BLEND_PATH = os.path.join(SCRIPT_DIR, 'sources', '3d', 'Text_cam_ref.blend')
OUTPUT_GLB = os.path.join(SCRIPT_DIR, 'assets', 'outergazers_text_fbx_style.glb')

bpy.ops.wm.open_mainfile(filepath=BLEND_PATH)

cam = bpy.data.objects['Camera']
inv_cam = cam.matrix_world.inverted()

# In Camera space, the front face has normal_cam.
# rot_align rotates camera space so that the front face normal becomes (0, 0, 1) and up becomes (0, 1, 0)
normal_world = mathutils.Vector((0, 1, 0))
normal_cam = (inv_cam.to_3x3() @ normal_world).normalized()
rot_align = normal_cam.rotation_difference(mathutils.Vector((0, 0, 1))).to_matrix().to_4x4()

# M_b maps the aligned camera space into Blender's standard coordinate system:
# Blender UP is +Z (= camera UP +Y)
# Blender FRONT is -Y (= camera FRONT +Z)
# Blender RIGHT is +X (= camera RIGHT +X)
M_b = mathutils.Matrix([
    [1,  0,  0, 0],
    [0,  0, -1, 0],
    [0,  1,  0, 0],
    [0,  0,  0, 1]
])

M_net = M_b @ rot_align @ inv_cam

final_scene = bpy.data.scenes.new('FinalScene')
bpy.context.window.scene = final_scene
final_col = bpy.data.collections.new('FinalCol')
final_scene.collection.children.link(final_col)

root_obj = bpy.data.objects.new('outergazers_text_root', None)
final_col.objects.link(root_obj)
root_obj.rotation_mode = 'XYZ'
root_obj.rotation_euler = (0, 0, 0)
created_objects = [root_obj]

mat_og = bpy.data.materials.get('Material_1.001') or bpy.data.materials.get('Material_1')
mat_gj = bpy.data.materials.get('Material_0.001') or bpy.data.materials.get('Material_0')

for mat in [mat_og, mat_gj]:
    if mat and mat.use_nodes:
        bsdf = [n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'][0]
        tex = [n for n in mat.node_tree.nodes if n.type == 'TEX_IMAGE'][0]
        mat.node_tree.links.new(tex.outputs['Color'], bsdf.inputs['Emission Color'])
        if 'Emission Strength' in bsdf.inputs:
            bsdf.inputs['Emission Strength'].default_value = 1.0

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

og_joined_list = []
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
        d.rotation_mode = 'XYZ'
        d.rotation_euler = (0, 0, 0)
        d.rotation_quaternion = (1, 0, 0, 0)
        d.matrix_world = mathutils.Matrix.Identity(4)
        d.data.update()
        d.select_set(True)
        dupes.append(d)
    final_scene.view_layers[0].objects.active = dupes[0]
    bpy.ops.object.join()
    joined = final_scene.view_layers[0].objects.active
    joined.name = label
    joined.rotation_mode = 'XYZ'
    joined.rotation_euler = (0, 0, 0)
    joined.rotation_quaternion = (1, 0, 0, 0)
    if mat_og:
        joined.data.materials.clear()
        joined.data.materials.append(mat_og)
    og_joined_list.append(joined)

# GJ
gj_root = bpy.data.objects['gamejam_2026.003']
R_fix = mathutils.Matrix.Rotation(math.pi / 2, 4, 'X')
inv_gj = gj_root.matrix_world.inverted()
M_gj_net = M_net @ gj_root.matrix_world @ R_fix @ inv_gj

gj_cubes = [c for c in gj_root.children_recursive if c.type == 'MESH']
bpy.ops.object.select_all(action='DESELECT')
dupes_gj = []
for c in gj_cubes:
    d = c.copy()
    d.data = c.data.copy()
    final_col.objects.link(d)
    mw = c.matrix_world
    M_obj = M_gj_net @ mw
    for v in d.data.vertices:
        v.co = M_obj @ v.co
    d.rotation_mode = 'XYZ'
    d.rotation_euler = (0, 0, 0)
    d.rotation_quaternion = (1, 0, 0, 0)
    d.matrix_world = mathutils.Matrix.Identity(4)
    d.data.update()
    d.select_set(True)
    dupes_gj.append(d)

final_scene.view_layers[0].objects.active = dupes_gj[0]
bpy.ops.object.join()
joined_gj = final_scene.view_layers[0].objects.active
joined_gj.name = 'Line_GameJam_2026'
joined_gj.rotation_mode = 'XYZ'
joined_gj.rotation_euler = (0, 0, 0)
joined_gj.rotation_quaternion = (1, 0, 0, 0)
if mat_gj:
    joined_gj.data.materials.clear()
    joined_gj.data.materials.append(mat_gj)

# Align GJ with OG coplanar in Blender space:
# In Blender space, Front face is MINIMUM Y (facing -Y)
front_y_og = min(v.co.y for o in og_joined_list for v in o.data.vertices)
front_y_gj = min(v.co.y for v in joined_gj.data.vertices)
shift_y = front_y_og - front_y_gj

# In Blender space, UP is +Z. Place GJ top just below OG bottom:
min_z_og = min(v.co.z for o in og_joined_list for v in o.data.vertices)
max_z_gj = max(v.co.z for v in joined_gj.data.vertices)
shift_z = (min_z_og - 0.25) - max_z_gj

for v in joined_gj.data.vertices:
    v.co.y += shift_y
    v.co.z += shift_z
joined_gj.data.update()

all_objs = og_joined_list + [joined_gj]

# Center the whole title in X and Z, and place front face at Y = 0
all_x = [v.co.x for o in all_objs for v in o.data.vertices]
mid_x = (min(all_x) + max(all_x)) / 2.0

all_z = [v.co.z for o in all_objs for v in o.data.vertices]
mid_z = (min(all_z) + max(all_z)) / 2.0

front_y = min(v.co.y for o in all_objs for v in o.data.vertices)

for o in all_objs:
    for v in o.data.vertices:
        v.co.x -= mid_x
        v.co.z -= mid_z
        v.co.y -= front_y # Front face at Y = 0
    o.data.update()

# Set object origin to bounding center of each piece
rest_configs = []
for o in all_objs:
    min_v = [min(v.co[i] for v in o.data.vertices) for i in range(3)]
    max_v = [max(v.co[i] for v in o.data.vertices) for i in range(3)]
    center = mathutils.Vector([(min_v[i] + max_v[i]) / 2.0 for i in range(3)])
    o.location = center
    for v in o.data.vertices:
        v.co -= center
    o.data.update()
    o.rotation_mode = 'XYZ'
    o.rotation_euler = (0, 0, 0)
    o.rotation_quaternion = (1, 0, 0, 0)
    o.parent = root_obj
    created_objects.append(o)
    rest_configs.append((o.name, round(center.x, 4), round(center.y, 4), round(center.z, 4)))

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
print('EXPORT_SUCCESS:', OUTPUT_GLB)
for name, rx, ry, rz in rest_configs:
    print('REST_CONFIG:', name, rx, ry, rz)
