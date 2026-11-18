"""Planeta procedural v3 — camadas (superfície, nuvens, atmosfera, anéis, espaço).

  blender -b --python planet_v3.py -- --type terra --seed 5 --out /tmp/terra.png
Tipos: terra, desert, lava, ice, gas. Câmera: full, closeup, probe.
"""
import bpy, math, random, sys

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
def arg(k, d=None): return argv[argv.index(k) + 1] if k in argv else d
PTYPE = arg("--type", "terra")
SEED = int(arg("--seed", "1"))
OUT = arg("--out", "/tmp/planet.png")
SIZE = int(arg("--size", "1024"))
SAMPLES = int(arg("--samples", "128"))
CAM = arg("--camera", "full")
RINGS = arg("--rings", "1" if PTYPE == "gas" else "0") == "1"
random.seed(SEED)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = "CYCLES"; sc.cycles.device = "GPU"
try:
    p = bpy.context.preferences.addons["cycles"].preferences
    p.compute_device_type = "CUDA"; p.get_devices()
    for d in p.devices: d.use = d.type == "CUDA"
except Exception as e: print("GPU:", e)
sc.cycles.samples = SAMPLES
sc.cycles.use_denoising = True
sc.render.resolution_x = sc.render.resolution_y = SIZE
sc.render.resolution_percentage = 100
sc.render.image_settings.file_format = "PNG"
sc.render.image_settings.color_mode = "RGB"
sc.render.filepath = OUT
sc.view_settings.view_transform = "AgX"
try: sc.view_settings.look = "AgX - Medium High Contrast"
except Exception: pass


def inp(n, names, v):
    for x in names:
        if x in n.inputs: n.inputs[x].default_value = v; return

def ramp(n, stops):
    e = n.color_ramp.elements
    while len(e) > 1: e.remove(e[-1])
    e[0].position, e[0].color = stops[0]
    for pos, col in stops[1:]:
        el = e.new(pos); el.color = col

def mat(name):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    return m, nt, out

def mapping(nt, scale=1.0):
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    mp.inputs["Location"].default_value = (random.random()*50, random.random()*50, random.random()*50)
    mp.inputs["Scale"].default_value = (scale, scale, scale)
    return tc, mp

def noise(nt, vec, scale, detail=10, rough=0.6, w=0.0):
    n = nt.nodes.new("ShaderNodeTexNoise"); n.noise_dimensions = "4D"
    n.inputs["Scale"].default_value = scale
    n.inputs["Detail"].default_value = detail
    n.inputs["Roughness"].default_value = rough
    n.inputs["W"].default_value = w
    nt.links.new(vec, n.inputs["Vector"])
    return n

def surface(kind):
    m, nt, out = mat("surface")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bsdf.outputs[0], out.inputs["Surface"])
    tc, mp = mapping(nt)
    inp(bsdf, ["Specular IOR Level", "Specular"], 0.3)

    n1 = noise(nt, mp.outputs["Vector"], 2.0, 12, 0.62, SEED*1.3)
    n2 = noise(nt, mp.outputs["Vector"], 6.0, 14, 0.6, SEED*2.1)
    n3 = noise(nt, mp.outputs["Vector"], 22.0, 10, 0.55, SEED*3.7)
    # cor
    c1 = nt.nodes.new("ShaderNodeValToRGB"); nt.links.new(n1.outputs["Fac"], c1.inputs["Fac"])
    c2 = nt.nodes.new("ShaderNodeValToRGB"); nt.links.new(n2.outputs["Fac"], c2.inputs["Fac"])
    mix = nt.nodes.new("ShaderNodeMixRGB"); mix.blend_type = "MULTIPLY"; mix.inputs["Fac"].default_value = 0.45
    nt.links.new(c1.outputs["Color"], mix.inputs["Color1"]); nt.links.new(c2.outputs["Color"], mix.inputs["Color2"])
    nt.links.new(mix.outputs["Color"], bsdf.inputs["Base Color"])
    inp(bsdf, ["Roughness"], 0.85)

    # relevo em duas escalas
    b1 = nt.nodes.new("ShaderNodeBump"); b1.inputs["Strength"].default_value = 0.45
    nt.links.new(n2.outputs["Fac"], b1.inputs["Height"])
    b2 = nt.nodes.new("ShaderNodeBump"); b2.inputs["Strength"].default_value = 0.22
    nt.links.new(n3.outputs["Fac"], b2.inputs["Height"])
    nt.links.new(b1.outputs["Normal"], b2.inputs["Normal"])
    nt.links.new(b2.outputs["Normal"], bsdf.inputs["Normal"])

    if kind == "terra":
        # máscara de oceano
        oc = nt.nodes.new("ShaderNodeValToRGB"); nt.links.new(n1.outputs["Fac"], oc.inputs["Fac"])
        ramp(oc, [(0.0, (0,0,0,1)), (0.47, (0,0,0,1)), (0.50, (1,1,1,1)), (1.0, (1,1,1,1))])
        land = nt.nodes.new("ShaderNodeValToRGB"); nt.links.new(n2.outputs["Fac"], land.inputs["Fac"])
        ramp(land, [(0.0, (0.10,0.16,0.06,1)), (0.35, (0.22,0.30,0.10,1)),
                    (0.55, (0.45,0.38,0.20,1)), (0.72, (0.55,0.44,0.28,1)),
                    (0.88, (0.62,0.58,0.48,1)), (1.0, (0.90,0.92,0.95,1))])
        ocean = nt.nodes.new("ShaderNodeValToRGB"); nt.links.new(n3.outputs["Fac"], ocean.inputs["Fac"])
        ramp(ocean, [(0.0, (0.002,0.012,0.04,1)), (0.5, (0.01,0.06,0.16,1)), (1.0, (0.03,0.18,0.32,1))])
        col = nt.nodes.new("ShaderNodeMixRGB"); nt.links.new(oc.outputs["Color"], col.inputs["Fac"])
        nt.links.new(ocean.outputs["Color"], col.inputs["Color1"])
        nt.links.new(land.outputs["Color"], col.inputs["Color2"])
        nt.links.new(col.outputs["Color"], bsdf.inputs["Base Color"])
        # rugosidade: mar liso, terra fosca
        rough = nt.nodes.new("ShaderNodeMapRange"); nt.links.new(oc.outputs["Color"], rough.inputs["Value"])
        rough.inputs["To Min"].default_value = 0.18; rough.inputs["To Max"].default_value = 0.92
        nt.links.new(rough.outputs["Result"], bsdf.inputs["Roughness"])
        # gelo nos polos
        sep = nt.nodes.new("ShaderNodeSeparateXYZ"); nt.links.new(tc.outputs["Object"], sep.inputs["Vector"])
        absz = nt.nodes.new("ShaderNodeMath"); absz.operation = "ABSOLUTE"; nt.links.new(sep.outputs["Z"], absz.inputs[0])
        ice = nt.nodes.new("ShaderNodeValToRGB"); nt.links.new(absz.outputs[0], ice.inputs["Fac"])
        ramp(ice, [(0.0, (0,0,0,1)), (0.78, (0,0,0,1)), (0.9, (1,1,1,1)), (1.0, (1,1,1,1))])
        mixice = nt.nodes.new("ShaderNodeMixRGB"); mixice.inputs["Fac"].default_value = 1.0
        nt.links.new(ice.outputs["Color"], mixice.inputs["Fac"])
        nt.links.new(col.outputs["Color"], mixice.inputs["Color1"])
        mixice.inputs["Color2"].default_value = (0.9, 0.94, 0.98, 1)
        nt.links.new(mixice.outputs["Color"], bsdf.inputs["Base Color"])
    elif kind == "desert":
        ramp(c1, [(0.0, (0.08,0.03,0.02,1)), (0.3, (0.28,0.09,0.04,1)),
                  (0.55, (0.55,0.26,0.10,1)), (0.75, (0.78,0.50,0.26,1)),
                  (0.9, (0.92,0.78,0.58,1)), (1.0, (0.98,0.94,0.86,1))])
        ramp(c2, [(0.0, (0.18,0.08,0.04,1)), (0.5, (0.50,0.30,0.14,1)), (1.0, (0.88,0.72,0.52,1))])
        b1.inputs["Strength"].default_value = 0.6
    elif kind == "ice":
        vor = nt.nodes.new("ShaderNodeTexVoronoi"); vor.feature = "DISTANCE_TO_EDGE"
        vor.inputs["Scale"].default_value = 6.0
        nt.links.new(mp.outputs["Vector"], vor.inputs["Vector"])
        cr = nt.nodes.new("ShaderNodeValToRGB"); nt.links.new(vor.outputs["Distance"], cr.inputs["Fac"])
        ramp(cr, [(0.0, (0.45,0.68,0.82,1)), (0.04, (0.85,0.93,1,1)), (1.0, (0.93,0.97,1,1))])
        nt.links.new(cr.outputs["Color"], bsdf.inputs["Base Color"])
    elif kind == "gas":
        wave = nt.nodes.new("ShaderNodeTexWave"); wave.wave_type = "BANDS"
        wave.bands_direction = "Z"; wave.inputs["Scale"].default_value = 2.2
        wave.inputs["Distortion"].default_value = 14.0; wave.inputs["Detail"].default_value = 6.0
        nt.links.new(mp.outputs["Vector"], wave.inputs["Vector"])
        ramp(c1, [(0.0, (0.10,0.05,0.02,1)), (0.3, (0.42,0.20,0.08,1)),
                  (0.55, (0.72,0.45,0.20,1)), (0.8, (0.90,0.74,0.48,1)),
                  (1.0, (0.97,0.92,0.78,1))])
        nt.links.new(wave.outputs["Color"], c1.inputs["Fac"])
        nt.links.new(c1.outputs["Color"], bsdf.inputs["Base Color"])
        inp(bsdf, ["Roughness"], 0.95)
        b1.inputs["Strength"].default_value = 0.15
    return m


def clouds(radius, seed, cover, alpha, scale, bump=0.35):
    m, nt, out = mat("clouds")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bsdf.outputs[0], out.inputs["Surface"])
    tc, mp = mapping(nt)
    n = noise(nt, mp.outputs["Vector"], scale, 14, 0.62, seed)
    r = nt.nodes.new("ShaderNodeValToRGB"); nt.links.new(n.outputs["Fac"], r.inputs["Fac"])
    ramp(r, [(0.0, (0,0,0,1)), (cover, (0,0,0,1)), (min(cover+0.06,0.98), (1,1,1,1)), (1.0, (1,1,1,1))])
    inp(bsdf, ["Base Color"], (1,1,1,1)); inp(bsdf, ["Roughness"], 0.95)
    nt.links.new(r.outputs["Color"], bsdf.inputs["Alpha"])
    inp(bsdf, ["Alpha"], alpha)
    b = nt.nodes.new("ShaderNodeBump"); b.inputs["Strength"].default_value = bump
    nt.links.new(n.outputs["Fac"], b.inputs["Height"])
    nt.links.new(b.outputs["Normal"], bsdf.inputs["Normal"])
    return m


def atmo(radius, color, density, name):
    m, nt, out = mat(name)
    vol = nt.nodes.new("ShaderNodeVolumePrincipled")
    vol.inputs["Color"].default_value = (*color, 1)
    vol.inputs["Density"].default_value = density
    vol.inputs["Anisotropy"].default_value = 0.35
    tc, mp = mapping(nt)
    grad = nt.nodes.new("ShaderNodeTexGradient"); grad.gradient_type = "SPHERICAL"
    nt.links.new(tc.outputs["Object"], grad.inputs["Vector"])
    g = nt.nodes.new("ShaderNodeValToRGB"); nt.links.new(grad.outputs["Fac"], g.inputs["Fac"])
    ramp(g, [(0.0, (0,0,0,1)), (0.86, (0,0,0,1)), (0.97, (1,1,1,1)), (1.0, (0,0,0,1))])
    mul = nt.nodes.new("ShaderNodeMath"); mul.operation = "MULTIPLY"; mul.inputs[1].default_value = density
    nt.links.new(g.outputs["Color"], mul.inputs[0])
    nt.links.new(mul.outputs[0], vol.inputs["Density"])
    nt.links.new(vol.outputs[0], out.inputs["Volume"])
    return m


def sphere(r, name, m, seg=160):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=seg//2, radius=r, location=(0,0,0))
    o = bpy.context.active_object; o.name = name
    bpy.ops.object.shade_smooth(); o.data.materials.append(m)
    return o

# planeta: icosphere densa + subsurf + deslocamento
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=6, radius=1.0, location=(0,0,0))
planet = bpy.context.active_object; planet.name = "Planet"
bpy.ops.object.shade_smooth(); planet.data.materials.append(surface(PTYPE))
if PTYPE in ("terra", "desert", "ice", "lava"):
    sub = planet.modifiers.new("sub", "SUBSURF"); sub.levels = 1; sub.render_levels = 1
    tex = bpy.data.textures.new("terrain", type="VORONOI" if PTYPE == "lava" else "CLOUDS")
    if hasattr(tex, "noise_scale"): tex.noise_scale = 0.5
    dm = planet.modifiers.new("disp", "DISPLACE"); dm.texture = tex
    dm.strength = 0.02 if PTYPE != "lava" else 0.045; dm.mid_level = 0.5

if PTYPE == "terra":
    for i, (rad, cover, alpha, scale) in enumerate([(1.012, 0.52, 0.55, 3.0), (1.020, 0.60, 0.28, 8.0)]):
        c = sphere(rad, f"Clouds{i}", clouds(rad, SEED*2.1+i, cover, alpha, scale, 0.4), seg=128)
        c.visible_shadow = False
elif PTYPE == "desert":
    c = sphere(1.010, "Clouds", clouds(1.010, SEED*2.4, 0.62, 0.22, 5.0, 0.15), seg=96)
    c.visible_shadow = False

if PTYPE != "lava":
    ACOL = {"terra": (0.45,0.68,1.0), "desert": (0.55,0.72,1.0), "ice": (0.55,0.78,1.0), "gas": (0.9,0.7,0.4)}[PTYPE]
    at = sphere(1.035, "Atmos", atmo(1.035, ACOL, 0.012 if PTYPE == "terra" else 0.006, "atmo"), seg=128)
    at.visible_shadow = False

if RINGS:
    bpy.ops.mesh.primitive_torus_add(major_radius=1.75, minor_radius=0.025, major_segments=256, minor_segments=8,
                                     location=(0,0,0), rotation=(math.radians(16), math.radians(-8), 0))
    ring = bpy.context.active_object
    rm, nt, out = mat("rings")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled"); nt.links.new(bsdf.outputs[0], out.inputs["Surface"])
    tc, mp = mapping(nt)
    n = noise(nt, mp.outputs["Vector"], 8.0, 8, 0.6, SEED*4.1)
    r = nt.nodes.new("ShaderNodeValToRGB"); nt.links.new(n.outputs["Fac"], r.inputs["Fac"])
    ramp(r, [(0.0, (0.25,0.22,0.18,1)), (0.4, (0.55,0.48,0.38,1)),
             (0.7, (0.78,0.70,0.58,1)), (1.0, (0.92,0.88,0.78,1))])
    nt.links.new(r.outputs["Color"], bsdf.inputs["Base Color"])
    inp(bsdf, ["Roughness"], 0.95)
    nt.links.new(n.outputs["Fac"], bsdf.inputs["Alpha"])
    inp(bsdf, ["Alpha"], 0.65)
    ring.data.materials.append(rm)

# fundo: nebulosa + estrelas + sol
bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=32, radius=40, location=(0,0,0))
bg = bpy.context.active_object; bg.name = "Nebula"
bm, nt, out = mat("nebula")
em = nt.nodes.new("ShaderNodeEmission")
tc, mp = mapping(nt, 0.35)
n = noise(nt, mp.outputs["Vector"], 1.4, 8, 0.6, SEED*0.7)
r = nt.nodes.new("ShaderNodeValToRGB"); nt.links.new(n.outputs["Fac"], r.inputs["Fac"])
ramp(r, [(0.0, (0.0,0.0,0.005,1)), (0.45, (0.005,0.008,0.02,1)),
         (0.65, (0.02,0.01,0.05,1)), (0.8, (0.06,0.03,0.10,1)), (1.0, (0.10,0.06,0.16,1))])
nt.links.new(r.outputs["Color"], em.inputs["Color"])
em.inputs["Strength"].default_value = 0.35
nt.links.new(em.outputs[0], out.inputs["Surface"])
bg.data.materials.append(bm)
bg.visible_shadow = False

stars = []
for i in range(160):
    u, v = random.uniform(0, 2*math.pi), math.acos(random.uniform(-1,1))
    loc = (35*math.sin(v)*math.cos(u), 35*math.sin(v)*math.sin(u), 35*math.cos(v))
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=random.uniform(0.012,0.032), location=loc)
    s = bpy.context.active_object
    sm, nt2, out2 = mat(f"star{i}")
    e2 = nt2.nodes.new("ShaderNodeEmission"); e2.inputs["Color"].default_value = (1,1,1,1)
    e2.inputs["Strength"].default_value = random.uniform(4, 14)
    nt2.links.new(e2.outputs[0], out2.inputs["Surface"])
    s.data.materials.append(sm); stars.append(s)
bpy.ops.object.select_all(action="DESELECT")
for s in stars: s.select_set(True)
bpy.context.view_layer.objects.active = stars[0]
bpy.ops.object.join()

# sol distante
bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=0.9, location=(-9, 7, 6))
sun = bpy.context.active_object
sm, nt, out = mat("sun")
e = nt.nodes.new("ShaderNodeEmission"); e.inputs["Color"].default_value = (1.0, 0.92, 0.8, 1)
e.inputs["Strength"].default_value = 40
nt.links.new(e.outputs[0], out.inputs["Surface"])
sun.data.materials.append(sm); sun.visible_shadow = False

# luz
bpy.ops.object.empty_add(location=(0,0,0)); target = bpy.context.active_object
def area(name, loc, energy, size, color):
    bpy.ops.object.light_add(type="AREA", location=loc)
    o = bpy.context.active_object; o.name = name
    o.data.energy = energy; o.data.size = size; o.data.color = color
    c = o.constraints.new("TRACK_TO"); c.target = target
    c.track_axis = "TRACK_NEGATIVE_Z"; c.up_axis = "UP_Y"
area("Key", (4.2, -1.2, 1.4), 2600, 0.6, (1.0, 0.94, 0.85))
area("Fill", (-3.6, -1.6, 0.4), 60, 4.0, (0.3, 0.5, 1.0))
area("Rim", (0.4, 3.4, 1.2), 250, 2.0, (0.5, 0.7, 1.0))

# câmera
if CAM == "closeup":
    bpy.ops.object.camera_add(location=(0.2, -2.15, 0.55)); lens = 75
elif CAM == "probe":
    bpy.ops.object.camera_add(location=(-2.6, -3.0, 1.0)); lens = 40
else:
    bpy.ops.object.camera_add(location=(0, -4.6, 0.35)); lens = 55
cam = bpy.context.active_object; cam.data.lens = lens
c = cam.constraints.new("TRACK_TO"); c.target = target
c.track_axis = "TRACK_NEGATIVE_Z"; c.up_axis = "UP_Y"
sc.camera = cam

# compositor (5.2: node group) — desligado no teste
try:
    raise RuntimeError("skip")
    ng = bpy.data.node_groups.new("Comp", "CompositorNodeTree")
    sc.compositing_node_group = ng
    ng.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
    rl = ng.nodes.new("CompositorNodeRLayers")
    gl = ng.nodes.new("CompositorNodeGlare"); gl.glare_type = "FOG_GLOW"; gl.quality = "HIGH"
    gl.threshold = 1.0; gl.size = 7
    outn = ng.nodes.new("NodeGroupOutput")
    ng.links.new(rl.outputs["Image"], gl.inputs["Image"])
    ng.links.new(gl.outputs["Image"], outn.inputs[0])
except Exception as e:
    print("compositor:", e)

bpy.ops.render.render(write_still=True)
print("OK", OUT)
