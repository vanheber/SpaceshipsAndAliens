"""Gerador procedural de planetas no Blender (Cycles, GPU).

Uso:
  blender -b --python planet_gen.py -- --type rocky --seed 7 --out /tmp/rocky.png
Tipos: rocky, ocean, gas, ice. 1024², 64 samples, denoise.
"""
import bpy
import math
import random
import sys
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
def arg(name, default=None):
    if name in argv:
        return argv[argv.index(name) + 1]
    return default
PTYPE = arg("--type", "rocky")
SEED = int(arg("--seed", "1"))
OUT = arg("--out", "/tmp/planet.png")
SIZE = int(arg("--size", "1024"))
SAMPLES = int(arg("--samples", "64"))
RINGS = arg("--rings", "0") == "1"

random.seed(SEED)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.device = "GPU"
try:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "CUDA"
    prefs.get_devices()
    for d in prefs.devices:
        d.use = d.type == "CUDA"
except Exception as e:
    print("GPU setup:", e)
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = True
scene.render.resolution_x = SIZE
scene.render.resolution_y = SIZE
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGB"
scene.render.filepath = OUT
scene.view_settings.view_transform = "AgX"


def inp(node, names, value):
    for n in names:
        if n in node.inputs:
            node.inputs[n].default_value = value
            return True
    return False


def ramp(node, stops):
    els = node.color_ramp.elements
    while len(els) > 1:
        els.remove(els[-1])
    els[0].position, els[0].color = stops[0]
    for pos, col in stops[1:]:
        e = els.new(pos)
        e.color = col


def new_mat(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    return m, nt, out


def planet_material(kind, seed):
    m, nt, out = new_mat("planet")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bsdf.outputs[0], out.inputs["Surface"])
    tex = nt.nodes.new("ShaderNodeTexCoord")
    mapn = nt.nodes.new("ShaderNodeMapping")
    nt.links.new(tex.outputs["Object"], mapn.inputs["Vector"])
    mapn.inputs["Location"].default_value = (random.random() * 10, random.random() * 10, random.random() * 10)
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.noise_dimensions = "4D"
    noise.inputs["W"].default_value = seed * 1.37
    noise.inputs["Detail"].default_value = 10.0
    noise.inputs["Roughness"].default_value = 0.62
    nt.links.new(mapn.outputs["Vector"], noise.inputs["Vector"])
    col = nt.nodes.new("ShaderNodeValToRGB")
    nt.links.new(noise.outputs["Fac"], col.inputs["Fac"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.35
    nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    inp(bsdf, ["Roughness"], 0.82)
    inp(bsdf, ["Specular IOR Level", "Specular"], 0.25)

    if kind == "gas":
        wave = nt.nodes.new("ShaderNodeTexWave")
        wave.wave_type = "BANDS"
        wave.bands_direction = "Z"
        wave.inputs["Scale"].default_value = 2.2
        wave.inputs["Distortion"].default_value = 9.0
        wave.inputs["Detail"].default_value = 4.0
        nt.links.new(mapn.outputs["Vector"], wave.inputs["Vector"])
        mix = nt.nodes.new("ShaderNodeMixRGB")
        mix.blend_type = "MULTIPLY"
        mix.inputs["Fac"].default_value = 0.55
        nt.links.new(wave.outputs["Color"], mix.inputs["Color1"])
        nt.links.new(noise.outputs["Fac"], mix.inputs["Color2"])
        nt.links.new(mix.outputs["Color"], col.inputs["Fac"])
        ramp(col, [(0.0, (0.10, 0.05, 0.02, 1)), (0.35, (0.45, 0.22, 0.08, 1)),
                   (0.55, (0.72, 0.48, 0.24, 1)), (0.75, (0.90, 0.76, 0.52, 1)),
                   (1.0, (0.98, 0.93, 0.78, 1))])
    elif kind == "ice":
        vor = nt.nodes.new("ShaderNodeTexVoronoi")
        vor.feature = "DISTANCE_TO_EDGE"
        vor.inputs["Scale"].default_value = 7.0
        nt.links.new(mapn.outputs["Vector"], vor.inputs["Vector"])
        nt.links.new(vor.outputs["Distance"], col.inputs["Fac"])
        ramp(col, [(0.0, (0.95, 0.98, 1.0, 1)), (0.35, (0.62, 0.82, 0.95, 1)),
                   (0.7, (0.12, 0.32, 0.48, 1)), (1.0, (0.03, 0.08, 0.14, 1))])
    elif kind == "ocean":
        ramp(col, [(0.0, (0.01, 0.05, 0.15, 1)), (0.35, (0.02, 0.16, 0.36, 1)),
                   (0.52, (0.05, 0.30, 0.48, 1)), (0.62, (0.20, 0.38, 0.22, 1)),
                   (0.75, (0.42, 0.40, 0.24, 1)), (1.0, (0.85, 0.88, 0.92, 1))])
    else:  # rocky
        ramp(col, [(0.0, (0.015, 0.03, 0.06, 1)), (0.42, (0.03, 0.12, 0.22, 1)),
                   (0.50, (0.16, 0.28, 0.12, 1)), (0.62, (0.42, 0.34, 0.18, 1)),
                   (0.78, (0.55, 0.50, 0.42, 1)), (1.0, (0.92, 0.94, 0.96, 1))])
    nt.links.new(col.outputs["Color"], bsdf.inputs["Base Color"])
    return m


def atmosphere(radius, color, strength, name):
    m, nt, out = new_mat(name)
    lw = nt.nodes.new("ShaderNodeLayerWeight")
    lw.inputs["Blend"].default_value = 0.45
    fac = nt.nodes.new("ShaderNodeValToRGB")
    nt.links.new(lw.outputs["Facing"], fac.inputs["Fac"])
    ramp(fac, [(0.0, (0, 0, 0, 1)), (0.55, (0, 0, 0, 1)), (0.78, (1, 1, 1, 1)), (1.0, (1, 1, 1, 1))])
    emis = nt.nodes.new("ShaderNodeEmission")
    emis.inputs["Color"].default_value = (*color, 1)
    emis.inputs["Strength"].default_value = strength
    trans = nt.nodes.new("ShaderNodeBsdfTransparent")
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(fac.outputs["Color"], mix.inputs[0])
    nt.links.new(trans.outputs[0], mix.inputs[1])
    nt.links.new(emis.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs["Surface"])
    return m


def clouds(radius, seed):
    m, nt, out = new_mat("clouds")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bsdf.outputs[0], out.inputs["Surface"])
    tex = nt.nodes.new("ShaderNodeTexCoord")
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.noise_dimensions = "4D"
    noise.inputs["W"].default_value = seed * 2.11
    noise.inputs["Scale"].default_value = 3.4
    noise.inputs["Detail"].default_value = 9.0
    nt.links.new(tex.outputs["Object"], noise.inputs["Vector"])
    fac = nt.nodes.new("ShaderNodeValToRGB")
    nt.links.new(noise.outputs["Fac"], fac.inputs["Fac"])
    ramp(fac, [(0.0, (0, 0, 0, 1)), (0.5, (0, 0, 0, 1)), (0.67, (1, 1, 1, 1)), (1.0, (1, 1, 1, 1))])
    inp(bsdf, ["Base Color"], (1, 1, 1, 1))
    inp(bsdf, ["Roughness"], 0.95)
    inp(bsdf, ["Alpha"], 0.38)
    nt.links.new(fac.outputs["Color"], bsdf.inputs["Alpha"])
    return m


def sphere(radius, name, mat, segments=128):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=segments // 2, radius=radius, location=(0, 0, 0))
    o = bpy.context.active_object
    o.name = name
    bpy.ops.object.shade_smooth()
    o.data.materials.append(mat)
    return o


# planet
pmat = planet_material(PTYPE, SEED)
planet = sphere(1.0, "Planet", pmat)
if PTYPE in ("rocky", "ice"):
    # irregular silhueta discreta
    tex = bpy.data.textures.new("disp", type="CLOUDS")
    tex.noise_scale = 0.45
    mod = planet.modifiers.new("disp", "DISPLACE")
    mod.texture = tex
    mod.strength = 0.012
    mod.mid_level = 0.5

# nuvens (não em gasoso)
if PTYPE != "gas":
    cm = clouds(1.014, SEED)
    cl = sphere(1.014, "Clouds", cm, segments=96)
    cl.visible_shadow = False

# atmosfera
ACOL = {"rocky": (0.25, 0.55, 1.0), "ocean": (0.2, 0.6, 1.0), "ice": (0.55, 0.8, 1.0), "gas": (0.9, 0.65, 0.35)}[PTYPE]
am = atmosphere(1.045, ACOL, 1.1, "atmosphere")
at = sphere(1.045, "Atmosphere", am, segments=96)
at.visible_shadow = False

# anéis
if RINGS:
    bpy.ops.mesh.primitive_torus_add(major_radius=1.65, minor_radius=0.22, major_segments=128, minor_segments=16, location=(0, 0, 0), rotation=(math.radians(18), math.radians(-12), 0))
    ring = bpy.context.active_object
    rm, nt, out = new_mat("rings")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bsdf.outputs[0], out.inputs["Surface"])
    tex = nt.nodes.new("ShaderNodeTexCoord")
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 8.0
    noise.inputs["Detail"].default_value = 8.0
    nt.links.new(tex.outputs["Object"], noise.inputs["Vector"])
    col = nt.nodes.new("ShaderNodeValToRGB")
    nt.links.new(noise.outputs["Fac"], col.inputs["Fac"])
    ramp(col, [(0.0, (0.35, 0.30, 0.24, 1)), (0.45, (0.62, 0.55, 0.44, 1)),
               (0.7, (0.80, 0.74, 0.62, 1)), (1.0, (0.92, 0.88, 0.78, 1))])
    nt.links.new(col.outputs["Color"], bsdf.inputs["Base Color"])
    inp(bsdf, ["Roughness"], 0.95)
    ring.data.materials.append(rm)

# estrelas: 260 esferas minúsculas unidas
stars = []
for i in range(260):
    u = random.uniform(0, 2 * math.pi)
    v = math.acos(random.uniform(-1, 1))
    r = 16.0
    loc = (r * math.sin(v) * math.cos(u), r * math.sin(v) * math.sin(u), r * math.cos(v))
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=random.uniform(0.03, 0.07), location=loc)
    s = bpy.context.active_object
    m = bpy.data.materials.new(f"star{i}")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    tint = random.choice([(1, 1, 1), (0.8, 0.9, 1), (1, 0.92, 0.8)])
    em.inputs["Color"].default_value = (*tint, 1)
    em.inputs["Strength"].default_value = random.uniform(8, 22)
    nt.links.new(em.outputs[0], out.inputs["Surface"])
    s.data.materials.append(m)
    stars.append(s)
bpy.ops.object.select_all(action="DESELECT")
for s in stars:
    s.select_set(True)
bpy.context.view_layer.objects.active = stars[0]
bpy.ops.object.join()
stars[0].name = "Stars"

# luz: área chave, preenchimento fraco e rim
def area_light(name, loc, energy, size, color):
    bpy.ops.object.light_add(type="AREA", location=loc)
    o = bpy.context.active_object
    o.name = name
    o.data.energy = energy
    o.data.size = size
    o.data.color = color
    c = o.constraints.new("TRACK_TO")
    c.target = target
    c.track_axis = "TRACK_NEGATIVE_Z"
    c.up_axis = "UP_Y"
    return o

bpy.ops.object.empty_add(location=(0, 0, 0))
target = bpy.context.active_object
area_light("Key", (3.4, -2.4, 1.6), 2600, 2.2, (1.0, 0.96, 0.9))
area_light("Fill", (-3.2, -1.4, 0.4), 120, 3.5, (0.35, 0.55, 1.0))
area_light("Rim", (0.5, 3.2, 1.4), 500, 2.0, (0.45, 0.7, 1.0))

# câmera
bpy.ops.object.camera_add(location=(0, -4.5, 0.28))
cam = bpy.context.active_object
cam.data.lens = 55
con = cam.constraints.new("TRACK_TO")
con.target = target
con.track_axis = "TRACK_NEGATIVE_Z"
con.up_axis = "UP_Y"
scene.camera = cam

# mundo escuro
world = bpy.data.worlds.new("Space")
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs["Color"].default_value = (0.002, 0.003, 0.006, 1)
bg.inputs["Strength"].default_value = 1.0

bpy.ops.render.render(write_still=True)
print("OK", OUT)
