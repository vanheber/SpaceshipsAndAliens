"""Planeta procedural v2 — foco em superfície detalhada (nodes) e close-up.

  blender -b --python planet_v2.py -- --type lava --seed 11 --out /tmp/lava.png
Tipos: lava, desert, ice, gas. --closeup 1 enquadra o limbo como referência.
"""
import bpy, math, random, sys

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
def arg(k, d=None):
    return argv[argv.index(k) + 1] if k in argv else d
PTYPE = arg("--type", "lava")
SEED = int(arg("--seed", "1"))
OUT = arg("--out", "/tmp/planet.png")
SIZE = int(arg("--size", "1024"))
SAMPLES = int(arg("--samples", "96"))
CLOSEUP = arg("--closeup", "0") == "1"
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
    print("GPU:", e)
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = True
scene.render.resolution_x = SIZE
scene.render.resolution_y = SIZE
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGB"
scene.render.filepath = OUT
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Medium High Contrast"


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
    for p, c in stops[1:]:
        e = els.new(p)
        e.color = c


def new_mat(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    return m, nt, out


def coords(nt):
    tex = nt.nodes.new("ShaderNodeTexCoord")
    m = nt.nodes.new("ShaderNodeMapping")
    nt.links.new(tex.outputs["Object"], m.inputs["Vector"])
    m.inputs["Location"].default_value = (random.random() * 20, random.random() * 20, random.random() * 20)
    return m


def surface(kind):
    m, nt, out = new_mat("surface")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bsdf.outputs[0], out.inputs["Surface"])
    mp = coords(nt)
    inp(bsdf, ["Roughness"], 0.92)
    inp(bsdf, ["Specular IOR Level", "Specular"], 0.2)

    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.noise_dimensions = "4D"
    noise.inputs["W"].default_value = SEED * 1.7
    noise.inputs["Detail"].default_value = 15.0
    noise.inputs["Roughness"].default_value = 0.65
    nt.links.new(mp.outputs["Vector"], noise.inputs["Vector"])
    col = nt.nodes.new("ShaderNodeValToRGB")
    nt.links.new(noise.outputs["Fac"], col.inputs["Fac"])
    nt.links.new(col.outputs["Color"], bsdf.inputs["Base Color"])

    # relevo: duas escalas
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.55
    nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    bump2 = nt.nodes.new("ShaderNodeBump")
    bump2.inputs["Strength"].default_value = 0.3
    nt.links.new(bump.outputs["Normal"], bump2.inputs["Normal"])

    if kind == "lava":
        # distorce as rachaduras para não virar célula de futebol
        dn = nt.nodes.new("ShaderNodeTexNoise")
        dn.inputs["Scale"].default_value = 0.8
        dn.inputs["Detail"].default_value = 5.0
        nt.links.new(mp.outputs["Vector"], dn.inputs["Vector"])
        mul = nt.nodes.new("ShaderNodeVectorMath"); mul.operation = "MULTIPLY"
        mul.inputs[1].default_value = (1.2, 1.2, 1.2)
        nt.links.new(dn.outputs["Color"], mul.inputs[0])
        addv = nt.nodes.new("ShaderNodeVectorMath"); addv.operation = "ADD"
        nt.links.new(mp.outputs["Vector"], addv.inputs[0])
        nt.links.new(mul.outputs["Vector"], addv.inputs[1])
        v1 = nt.nodes.new("ShaderNodeTexVoronoi"); v1.feature = "DISTANCE_TO_EDGE"
        v1.inputs["Scale"].default_value = 2.8; v1.inputs["Randomness"].default_value = 1.0
        nt.links.new(addv.outputs["Vector"], v1.inputs["Vector"])
        v2 = nt.nodes.new("ShaderNodeTexVoronoi"); v2.feature = "DISTANCE_TO_EDGE"
        v2.inputs["Scale"].default_value = 6.0; v2.inputs["Randomness"].default_value = 1.0
        nt.links.new(addv.outputs["Vector"], v2.inputs["Vector"])
        r1 = nt.nodes.new("ShaderNodeValToRGB"); nt.links.new(v1.outputs["Distance"], r1.inputs["Fac"])
        ramp(r1, [(0.0, (1, 1, 1, 1)), (0.012, (0, 0, 0, 1)), (1.0, (0, 0, 0, 1))])
        r2 = nt.nodes.new("ShaderNodeValToRGB"); nt.links.new(v2.outputs["Distance"], r2.inputs["Fac"])
        ramp(r2, [(0.0, (1, 1, 1, 1)), (0.006, (0, 0, 0, 1)), (1.0, (0, 0, 0, 1))])
        mx = nt.nodes.new("ShaderNodeMixRGB"); mx.blend_type = "LIGHTEN"; mx.inputs["Fac"].default_value = 1.0
        nt.links.new(r1.outputs["Color"], mx.inputs["Color1"])
        nt.links.new(r2.outputs["Color"], mx.inputs["Color2"])
        # poças de magma em baixa frequência
        pool = nt.nodes.new("ShaderNodeTexNoise")
        pool.inputs["Scale"].default_value = 2.0; pool.inputs["Detail"].default_value = 8.0
        nt.links.new(mp.outputs["Vector"], pool.inputs["Vector"])
        pr = nt.nodes.new("ShaderNodeValToRGB"); nt.links.new(pool.outputs["Fac"], pr.inputs["Fac"])
        ramp(pr, [(0.0, (0, 0, 0, 1)), (0.62, (0, 0, 0, 1)), (0.635, (1, 1, 1, 1)), (1.0, (1, 1, 1, 1))])
        # quebra a malha de rachaduras com manchas de baixa frequência
        gap = nt.nodes.new("ShaderNodeTexNoise")
        gap.inputs["Scale"].default_value = 1.1; gap.inputs["Detail"].default_value = 4.0
        nt.links.new(mp.outputs["Vector"], gap.inputs["Vector"])
        gr = nt.nodes.new("ShaderNodeValToRGB"); nt.links.new(gap.outputs["Fac"], gr.inputs["Fac"])
        ramp(gr, [(0.0, (0.02, 0.02, 0.02, 1)), (0.55, (0.04, 0.04, 0.04, 1)), (0.68, (1, 1, 1, 1)), (1.0, (1, 1, 1, 1))])
        br = nt.nodes.new("ShaderNodeMixRGB"); br.blend_type = "MULTIPLY"; br.inputs["Fac"].default_value = 1.0
        nt.links.new(mx.outputs["Color"], br.inputs["Color1"])
        nt.links.new(gr.outputs["Color"], br.inputs["Color2"])
        mm = nt.nodes.new("ShaderNodeMixRGB"); mm.blend_type = "ADD"; mm.inputs["Fac"].default_value = 0.45
        nt.links.new(br.outputs["Color"], mm.inputs["Color1"])
        nt.links.new(pr.outputs["Color"], mm.inputs["Color2"])
        # emissão só na máscara
        em = nt.nodes.new("ShaderNodeEmission")
        em.inputs["Color"].default_value = (1.0, 0.16, 0.02, 1)
        em.inputs["Strength"].default_value = 12.0
        mix = nt.nodes.new("ShaderNodeMixShader")
        nt.links.new(mm.outputs["Color"], mix.inputs[0])
        nt.links.new(bsdf.outputs[0], mix.inputs[1])
        nt.links.new(em.outputs[0], mix.inputs[2])
        for l in list(out.inputs["Surface"].links):
            nt.links.remove(l)
        nt.links.new(mix.outputs[0], out.inputs["Surface"])
        # base basáltica escura
        ramp(col, [(0.0, (0.008, 0.007, 0.007, 1)), (0.35, (0.035, 0.025, 0.022, 1)),
                   (0.55, (0.08, 0.05, 0.035, 1)), (0.75, (0.16, 0.11, 0.08, 1)),
                   (1.0, (0.28, 0.24, 0.20, 1))])
        inp(bsdf, ["Emission Strength"], 0.0)
        nt.links.new(bump.outputs["Normal"], bump2.inputs["Normal"])
        nt.links.new(bump2.outputs["Normal"], bsdf.inputs["Normal"])
    elif kind == "desert":
        ramp(col, [(0.0, (0.10, 0.03, 0.02, 1)), (0.35, (0.38, 0.12, 0.05, 1)),
                   (0.55, (0.62, 0.30, 0.12, 1)), (0.72, (0.82, 0.55, 0.28, 1)),
                   (0.86, (0.92, 0.80, 0.62, 1)), (1.0, (0.98, 0.95, 0.90, 1))])
        nt.links.new(bump.outputs["Normal"], bump2.inputs["Normal"])
        nt.links.new(bump2.outputs["Normal"], bsdf.inputs["Normal"])
    elif kind == "ice":
        vor = nt.nodes.new("ShaderNodeTexVoronoi")
        vor.feature = "DISTANCE_TO_EDGE"
        vor.inputs["Scale"].default_value = 5.5
        nt.links.new(mp.outputs["Vector"], vor.inputs["Vector"])
        cr = nt.nodes.new("ShaderNodeValToRGB")
        nt.links.new(vor.outputs["Distance"], cr.inputs["Fac"])
        ramp(cr, [(0.0, (0.55, 0.75, 0.85, 1)), (0.03, (0.9, 0.96, 1, 1)), (1.0, (0.92, 0.97, 1, 1))])
        nt.links.new(cr.outputs["Color"], bsdf.inputs["Base Color"])
        nt.links.new(bump.outputs["Normal"], bump2.inputs["Normal"])
        nt.links.new(bump2.outputs["Normal"], bsdf.inputs["Normal"])
    else:  # gas
        wave = nt.nodes.new("ShaderNodeTexWave")
        wave.wave_type = "BANDS"
        wave.bands_direction = "Z"
        wave.inputs["Scale"].default_value = 2.0
        wave.inputs["Distortion"].default_value = 12.0
        wave.inputs["Detail"].default_value = 5.0
        nt.links.new(mp.outputs["Vector"], wave.inputs["Vector"])
        ramp(col, [(0.0, (0.08, 0.05, 0.03, 1)), (0.3, (0.35, 0.18, 0.08, 1)),
                   (0.55, (0.68, 0.42, 0.20, 1)), (0.78, (0.88, 0.72, 0.48, 1)),
                   (1.0, (0.96, 0.90, 0.76, 1))])
        nt.links.new(wave.outputs["Color"], col.inputs["Fac"])
        nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return m


def atmosphere(radius, color, strength, thin=0.9):
    m, nt, out = new_mat("atmo")
    lw = nt.nodes.new("ShaderNodeLayerWeight")
    lw.inputs["Blend"].default_value = 0.5
    fac = nt.nodes.new("ShaderNodeValToRGB")
    nt.links.new(lw.outputs["Facing"], fac.inputs["Fac"])
    ramp(fac, [(0.0, (0, 0, 0, 1)), (thin, (0, 0, 0, 1)), (0.985, (1, 1, 1, 1)), (1.0, (1, 1, 1, 1))])
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (*color, 1)
    em.inputs["Strength"].default_value = strength
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(fac.outputs["Color"], mix.inputs[0])
    nt.links.new(tr.outputs[0], mix.inputs[1])
    nt.links.new(em.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs["Surface"])
    return m


def clouds(seed, coverage=0.6, alpha=0.3):
    m, nt, out = new_mat("clouds")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bsdf.outputs[0], out.inputs["Surface"])
    mp = coords(nt)
    n = nt.nodes.new("ShaderNodeTexNoise")
    n.noise_dimensions = "4D"
    n.inputs["W"].default_value = seed * 2.3
    n.inputs["Scale"].default_value = 4.5
    n.inputs["Detail"].default_value = 12.0
    nt.links.new(mp.outputs["Vector"], n.inputs["Vector"])
    r = nt.nodes.new("ShaderNodeValToRGB")
    nt.links.new(n.outputs["Fac"], r.inputs["Fac"])
    ramp(r, [(0.0, (0, 0, 0, 1)), (coverage, (0, 0, 0, 1)), (coverage + 0.08, (1, 1, 1, 1)), (1.0, (1, 1, 1, 1))])
    inp(bsdf, ["Base Color"], (1, 1, 1, 1))
    inp(bsdf, ["Roughness"], 0.95)
    nt.links.new(r.outputs["Color"], bsdf.inputs["Alpha"])
    inp(bsdf, ["Alpha"], alpha)
    return m


def sphere(radius, name, mat, seg=160):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=seg // 2, radius=radius, location=(0, 0, 0))
    o = bpy.context.active_object
    o.name = name
    bpy.ops.object.shade_smooth()
    o.data.materials.append(mat)
    return o


pmat = surface(PTYPE)
planet = sphere(1.0, "Planet", pmat)
if PTYPE in ("lava", "desert", "ice"):
    sub = planet.modifiers.new("sub", "SUBSURF")
    sub.levels = 2
    sub.render_levels = 2
    tex = bpy.data.textures.new("terrain", type="VORONOI" if PTYPE == "lava" else "CLOUDS")
    if hasattr(tex, "noise_scale"):
        tex.noise_scale = 0.35 if PTYPE == "lava" else 0.55
    mod = planet.modifiers.new("disp", "DISPLACE")
    mod.texture = tex
    mod.strength = 0.018 if PTYPE != "lava" else 0.045
    mod.mid_level = 0.5

if PTYPE in ("desert", "ice"):
    cl = sphere(1.012, "Clouds", clouds(SEED, 0.58 if PTYPE == "desert" else 0.66, 0.5), seg=96)
    cl.visible_shadow = False

ACOL = {"lava": (1.0, 0.35, 0.08), "desert": (0.55, 0.72, 1.0), "ice": (0.6, 0.8, 1.0), "gas": (0.9, 0.7, 0.4)}[PTYPE]
if PTYPE != "lava":
    AT = sphere(1.035, "Atmos", atmosphere(1.035, ACOL, 0.8, 0.94), seg=96)
    AT.visible_shadow = False

# estrelas discretas
stars = []
for i in range(90):
    u, v = random.uniform(0, 2 * math.pi), math.acos(random.uniform(-1, 1))
    loc = (18 * math.sin(v) * math.cos(u), 18 * math.sin(v) * math.sin(u), 18 * math.cos(v))
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=random.uniform(0.02, 0.05), location=loc)
    s = bpy.context.active_object
    m = bpy.data.materials.new(f"st{i}")
    m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (1, 1, 1, 1)
    em.inputs["Strength"].default_value = random.uniform(3, 10)
    nt.links.new(em.outputs[0], out.inputs["Surface"])
    s.data.materials.append(m); stars.append(s)
bpy.ops.object.select_all(action="DESELECT")
for s in stars: s.select_set(True)
bpy.context.view_layer.objects.active = stars[0]
bpy.ops.object.join()

# luz
bpy.ops.object.empty_add(location=(0, 0, 0))
target = bpy.context.active_object
def area(name, loc, energy, size, color):
    bpy.ops.object.light_add(type="AREA", location=loc)
    o = bpy.context.active_object; o.name = name
    o.data.energy = energy; o.data.size = size; o.data.color = color
    c = o.constraints.new("TRACK_TO"); c.target = target
    c.track_axis = "TRACK_NEGATIVE_Z"; c.up_axis = "UP_Y"
area("Key", (4.6, 0.4, 1.0), 700, 0.4, (1.0, 0.93, 0.82))
area("Fill", (-3.2, -1.2, 0.2), 0.5, 4.0, (0.3, 0.5, 1.0))
if PTYPE == "lava":
    area("Rim", (0.2, 3.0, 1.0), 120, 3.0, (1.0, 0.4, 0.12))

# câmera close-up ou plano
if CLOSEUP:
    bpy.ops.object.camera_add(location=(0.15, -2.05, 0.55))
else:
    bpy.ops.object.camera_add(location=(0, -4.3, 0.32))
cam = bpy.context.active_object
cam.data.lens = 70 if CLOSEUP else 55
cam.data.dof.use_dof = False
c = cam.constraints.new("TRACK_TO"); c.target = target
c.track_axis = "TRACK_NEGATIVE_Z"; c.up_axis = "UP_Y"
scene.camera = cam

world = bpy.data.worlds.new("Space"); scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs["Color"].default_value = (0.001, 0.0015, 0.003, 1)
bg.inputs["Strength"].default_value = 1.0

bpy.ops.render.render(write_still=True)
print("OK", OUT)
