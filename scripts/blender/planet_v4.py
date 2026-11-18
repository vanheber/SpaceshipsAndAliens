"""Planeta procedural v4 — camadas de superfície, nuvens, atmosfera, noite.

  blender -b --python planet_v4.py -- --type desert --seed 7 --out /tmp/desert.png
Tipos: desert, terra, ice, lava, gas. Câmera: full, closeup, probe.
"""
import bpy, math, random, sys

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
def arg(k, d=None): return argv[argv.index(k) + 1] if k in argv else d
PTYPE = arg("--type", "desert")
SEED = int(arg("--seed", "1"))
OUT = arg("--out", "/tmp/planet.png")
SIZE = int(arg("--size", "1024"))
SAMPLES = int(arg("--samples", "160"))
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
    mp.inputs["Location"].default_value = (random.random()*40, random.random()*40, random.random()*40)
    mp.inputs["Scale"].default_value = (scale, scale, scale)
    return tc, mp

def noise(nt, vec, scale, detail=10, rough=0.6, w=0.0, distortion=0.0):
    n = nt.nodes.new("ShaderNodeTexNoise"); n.noise_dimensions = "4D"
    n.inputs["Scale"].default_value = scale
    n.inputs["Detail"].default_value = detail
    n.inputs["Roughness"].default_value = rough
    n.inputs["Distortion"].default_value = distortion
    n.inputs["W"].default_value = w
    nt.links.new(vec, n.inputs["Vector"])
    return n

def surface(kind):
    m, nt, out = mat("surface")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bsdf.outputs[0], out.inputs["Surface"])
    tc, mp = mapping(nt)
    inp(bsdf, ["Specular IOR Level", "Specular"], 0.25)

    # camada 1 — base (sem bump)
    base = noise(nt, mp.outputs["Vector"], 1.2, 10, 0.6, SEED*0.7, 1.2)
    bcol = nt.nodes.new("ShaderNodeValToRGB"); nt.links.new(base.outputs["Fac"], bcol.inputs["Fac"])
    # camada 2 — continentes/montanhas
    mt = noise(nt, mp.outputs["Vector"], 12.0, 20, 0.7, SEED*1.9, 3.0)
    mcol = nt.nodes.new("ShaderNodeValToRGB"); nt.links.new(mt.outputs["Fac"], mcol.inputs["Fac"])
    # camada 3 — detalhe fino
    det = noise(nt, mp.outputs["Vector"], 80.0, 15, 0.55, SEED*3.1)
    dcol = nt.nodes.new("ShaderNodeValToRGB"); nt.links.new(det.outputs["Fac"], dcol.inputs["Fac"])
    # cristas / crateras
    vor = nt.nodes.new("ShaderNodeTexVoronoi"); vor.feature = "DISTANCE_TO_EDGE"
    vor.inputs["Scale"].default_value = 12.0; vor.inputs["Randomness"].default_value = 1.0
    nt.links.new(mp.outputs["Vector"], vor.inputs["Vector"])
    vr = nt.nodes.new("ShaderNodeValToRGB"); nt.links.new(vor.outputs["Distance"], vr.inputs["Fac"])
    ramp(vr, [(0.0, (1,1,1,1)), (0.02, (0,0,0,1)), (1.0, (0,0,0,1))])
    # crateras circulares
    cr = nt.nodes.new("ShaderNodeTexVoronoi"); cr.feature = "F1"
    cr.inputs["Scale"].default_value = 55.0; cr.inputs["Randomness"].default_value = 1.0
    nt.links.new(mp.outputs["Vector"], cr.inputs["Vector"])
    crr = nt.nodes.new("ShaderNodeValToRGB"); nt.links.new(cr.outputs["Distance"], crr.inputs["Fac"])
    ramp(crr, [(0.0, (1,1,1,1)), (0.05, (0.4,0.4,0.4,1)), (0.08, (0,0,0,1)), (1.0, (0,0,0,1))])

    # cor por tipo
    if kind == "desert":
        ramp(bcol, [(0.0, (0.03,0.015,0.01,1)), (0.35, (0.14,0.05,0.03,1)),
                    (0.55, (0.32,0.12,0.05,1)), (0.75, (0.52,0.26,0.12,1)), (1.0, (0.72,0.45,0.24,1))])
        ramp(mcol, [(0.0, (0.08,0.03,0.02,1)), (0.3, (0.28,0.10,0.05,1)),
                    (0.52, (0.52,0.25,0.10,1)), (0.7, (0.72,0.46,0.22,1)),
                    (0.86, (0.86,0.68,0.44,1)), (1.0, (0.95,0.90,0.80,1))])
        ramp(dcol, [(0.0, (0.04,0.02,0.015,1)), (0.5, (0.30,0.15,0.08,1)), (1.0, (0.75,0.55,0.34,1))])
    elif kind == "terra":
        ramp(bcol, [(0.0, (0.002,0.012,0.04,1)), (0.55, (0.006,0.04,0.12,1)), (1.0, (0.02,0.10,0.20,1))])
        ramp(mcol, [(0.0, (0.06,0.14,0.05,1)), (0.35, (0.16,0.28,0.09,1)),
                    (0.55, (0.34,0.32,0.16,1)), (0.72, (0.50,0.42,0.26,1)),
                    (0.86, (0.70,0.66,0.56,1)), (1.0, (0.94,0.96,0.98,1))])
        ramp(dcol, [(0.0, (0.01,0.03,0.08,1)), (0.5, (0.05,0.18,0.10,1)), (1.0, (0.45,0.40,0.28,1))])
    elif kind == "ice":
        ramp(bcol, [(0.0, (0.45,0.65,0.80,1)), (0.5, (0.70,0.85,0.95,1)), (1.0, (0.94,0.98,1,1))])
        ramp(mcol, [(0.0, (0.55,0.72,0.84,1)), (0.45, (0.80,0.90,0.98,1)), (1.0, (0.98,1,1,1))])
        ramp(dcol, [(0.0, (0.35,0.55,0.70,1)), (0.5, (0.75,0.88,0.96,1)), (1.0, (1,1,1,1))])
    elif kind == "gas":
        wave = nt.nodes.new("ShaderNodeTexWave"); wave.wave_type = "BANDS"; wave.bands_direction = "Z"
        wave.inputs["Scale"].default_value = 2.2; wave.inputs["Distortion"].default_value = 14.0
        wave.inputs["Detail"].default_value = 6.0
        nt.links.new(mp.outputs["Vector"], wave.inputs["Vector"])
        ramp(bcol, [(0.0, (0.08,0.04,0.02,1)), (0.3, (0.38,0.18,0.07,1)),
                    (0.55, (0.68,0.42,0.18,1)), (0.8, (0.88,0.72,0.46,1)), (1.0, (0.97,0.92,0.78,1))])
        nt.links.new(wave.outputs["Color"], bcol.inputs["Fac"])
        ramp(mcol, [(0.0, (0.60,0.35,0.15,1)), (1.0, (0.95,0.85,0.65,1))])
        ramp(dcol, [(0.0, (0.5,0.3,0.12,1)), (1.0, (0.9,0.8,0.6,1))])

    # mix camadas 1→2→3
    mix1 = nt.nodes.new("ShaderNodeMixRGB"); mix1.blend_type = "MIX"; mix1.inputs["Fac"].default_value = 0.55
    nt.links.new(bcol.outputs["Color"], mix1.inputs["Color1"])
    nt.links.new(mcol.outputs["Color"], mix1.inputs["Color2"])
    mix2 = nt.nodes.new("ShaderNodeMixRGB"); mix2.blend_type = "OVERLAY"; mix2.inputs["Fac"].default_value = 0.15
    nt.links.new(mix1.outputs["Color"], mix2.inputs["Color1"])
    nt.links.new(dcol.outputs["Color"], mix2.inputs["Color2"])
    # cristas escurecem
    mix3 = nt.nodes.new("ShaderNodeMixRGB"); mix3.blend_type = "MULTIPLY"; mix3.inputs["Fac"].default_value = 0.12
    nt.links.new(mix2.outputs["Color"], mix3.inputs["Color1"])
    nt.links.new(vr.outputs["Color"], mix3.inputs["Color2"])
    nt.links.new(mix3.outputs["Color"], bsdf.inputs["Base Color"])

    # bump: detalhe + montanha + cristas
    b1 = nt.nodes.new("ShaderNodeBump"); b1.inputs["Strength"].default_value = 0.8
    nt.links.new(mt.outputs["Fac"], b1.inputs["Height"])
    b2 = nt.nodes.new("ShaderNodeBump"); b2.inputs["Strength"].default_value = 0.5
    nt.links.new(det.outputs["Fac"], b2.inputs["Height"])
    nt.links.new(b1.outputs["Normal"], b2.inputs["Normal"])
    b3 = nt.nodes.new("ShaderNodeBump"); b3.inputs["Strength"].default_value = 0.12
    nt.links.new(vr.outputs["Color"], b3.inputs["Height"])
    nt.links.new(b2.outputs["Normal"], b3.inputs["Normal"])
    nt.links.new(b3.outputs["Normal"], bsdf.inputs["Normal"])
    inp(bsdf, ["Roughness"], 0.9)

    # luzes noturnas (só no lado escuro) — cidades em terra
    sunv = nt.nodes.new("ShaderNodeCombineXYZ"); sunv.inputs[0].default_value = 0.86
    sunv.inputs[1].default_value = -0.25; sunv.inputs[2].default_value = 0.44
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    dot = nt.nodes.new("ShaderNodeVectorMath"); dot.operation = "DOT_PRODUCT"
    nt.links.new(geo.outputs["Normal"], dot.inputs[0]); nt.links.new(sunv.outputs["Vector"], dot.inputs[1])
    night = nt.nodes.new("ShaderNodeMapRange"); nt.links.new(dot.outputs["Value"], night.inputs["Value"])
    night.inputs["From Min"].default_value = -1.0; night.inputs["From Max"].default_value = 1.0
    night.inputs["To Min"].default_value = 0.0; night.inputs["To Max"].default_value = 1.0
    nr = nt.nodes.new("ShaderNodeValToRGB"); nt.links.new(night.outputs["Result"], nr.inputs["Fac"])
    ramp(nr, [(0.0, (1,1,1,1)), (0.45, (1,1,1,1)), (0.52, (0,0,0,1)), (1.0, (0,0,0,1))])
    cityn = noise(nt, mp.outputs["Vector"], 120.0, 10, 0.55, SEED*5.3)
    cityr = nt.nodes.new("ShaderNodeValToRGB"); nt.links.new(cityn.outputs["Fac"], cityr.inputs["Fac"])
    ramp(cityr, [(0.0, (0,0,0,1)), (0.84, (0,0,0,1)), (0.87, (1,1,1,1)), (1.0, (1,1,1,1))])
    cm = nt.nodes.new("ShaderNodeMixRGB"); cm.blend_type = "MULTIPLY"; cm.inputs["Fac"].default_value = 1.0
    nt.links.new(cityr.outputs["Color"], cm.inputs["Color1"]); nt.links.new(nr.outputs["Color"], cm.inputs["Color2"])
    if kind == "desert":
        # cidades só onde há terreno, não em mares (deserto não tem)
        pass
    st = nt.nodes.new("ShaderNodeMath"); st.operation = "MULTIPLY"; st.inputs[1].default_value = 1.4
    nt.links.new(cm.outputs["Color"], st.inputs[0])
    inp(bsdf, ["Emission Color"], (1.0, 0.55, 0.22, 1))
    nt.links.new(st.outputs[0], bsdf.inputs["Emission Strength"])
    return m


def clouds(radius, seed, cover, alpha, scale, bump):
    m, nt, out = mat("clouds")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bsdf.outputs[0], out.inputs["Surface"])
    tc, mp = mapping(nt)
    n = noise(nt, mp.outputs["Vector"], scale, 15, 0.62, seed, 0.8)
    r = nt.nodes.new("ShaderNodeValToRGB"); nt.links.new(n.outputs["Fac"], r.inputs["Fac"])
    ramp(r, [(0.0, (0,0,0,1)), (cover, (0,0,0,1)), (min(cover+0.05,0.97), (1,1,1,1)), (1.0, (1,1,1,1))])
    inp(bsdf, ["Base Color"], (1,1,1,1)); inp(bsdf, ["Roughness"], 0.95)
    nt.links.new(r.outputs["Color"], bsdf.inputs["Alpha"]); inp(bsdf, ["Alpha"], alpha)
    b = nt.nodes.new("ShaderNodeBump"); b.inputs["Strength"].default_value = bump
    nt.links.new(n.outputs["Fac"], b.inputs["Height"]); nt.links.new(b.outputs["Normal"], bsdf.inputs["Normal"])
    return m


def atmo(radius, color, density):
    m, nt, out = mat("atmo")
    vol = nt.nodes.new("ShaderNodeVolumePrincipled")
    vol.inputs["Color"].default_value = (*color, 1)
    vol.inputs["Anisotropy"].default_value = 0.4
    tc, mp = mapping(nt)
    grad = nt.nodes.new("ShaderNodeTexGradient"); grad.gradient_type = "SPHERICAL"
    nt.links.new(tc.outputs["Object"], grad.inputs["Vector"])
    g = nt.nodes.new("ShaderNodeValToRGB"); nt.links.new(grad.outputs["Fac"], g.inputs["Fac"])
    ramp(g, [(0.0, (0,0,0,1)), (0.86, (0,0,0,1)), (0.96, (1,1,1,1)), (1.0, (0,0,0,1))])
    mul = nt.nodes.new("ShaderNodeMath"); mul.operation = "MULTIPLY"; mul.inputs[1].default_value = density
    nt.links.new(g.outputs["Color"], mul.inputs[0]); nt.links.new(mul.outputs[0], vol.inputs["Density"])
    nt.links.new(vol.outputs[0], out.inputs["Volume"])
    return m


def sphere(r, name, m, seg=160):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=seg//2, radius=r, location=(0,0,0))
    o = bpy.context.active_object; o.name = name
    bpy.ops.object.shade_smooth(); o.data.materials.append(m)
    return o

# superfície de alta densidade
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=6, radius=1.0, location=(0,0,0))
planet = bpy.context.active_object; planet.name = "Planet"
bpy.ops.object.shade_smooth(); planet.data.materials.append(surface(PTYPE))
if PTYPE != "gas":
    sub = planet.modifiers.new("sub", "SUBSURF"); sub.levels = 2; sub.render_levels = 2
    tex = bpy.data.textures.new("terrain", type="CLOUDS")
    tex.noise_scale = 0.2; tex.noise_depth = 6
    dm = planet.modifiers.new("disp", "DISPLACE"); dm.texture = tex
    dm.strength = 0.08; dm.mid_level = 0.5

# nuvens
if PTYPE == "terra":
    for i, (rad, cover, alpha, scale, bump) in enumerate([(1.010, 0.55, 0.5, 3.0, 0.35), (1.020, 0.62, 0.35, 8.0, 0.7)]):
        c = sphere(rad, f"Clouds{i}", clouds(rad, SEED*2.3+i, cover, alpha, scale, bump), seg=128)
        c.visible_shadow = False
elif PTYPE == "desert":
    c = sphere(1.012, "Clouds", clouds(1.012, SEED*2.7, 0.66, 0.16, 7.0, 0.2), seg=128)
    c.visible_shadow = False


# atmosfera
if PTYPE != "lava":
    ACOL = {"terra": (0.45,0.68,1.0), "desert": (0.75,0.62,0.5), "ice": (0.55,0.78,1.0), "gas": (0.9,0.7,0.4)}[PTYPE]
    at = sphere(1.04, "Atmos", atmo(1.04, ACOL, 0.10 if PTYPE == "desert" else 0.012), seg=128)
    at.visible_shadow = False

# anéis
if RINGS:
    bpy.ops.mesh.primitive_torus_add(major_radius=1.75, minor_radius=0.03, major_segments=256, minor_segments=8,
                                     location=(0,0,0), rotation=(math.radians(16), math.radians(-8), 0))
    ring = bpy.context.active_object
    rm, nt, out = mat("rings")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled"); nt.links.new(bsdf.outputs[0], out.inputs["Surface"])
    tc, mp = mapping(nt)
    n = noise(nt, mp.outputs["Vector"], 9.0, 8, 0.6, SEED*4.1)
    r = nt.nodes.new("ShaderNodeValToRGB"); nt.links.new(n.outputs["Fac"], r.inputs["Fac"])
    ramp(r, [(0.0, (0.20,0.18,0.15,1)), (0.4, (0.55,0.48,0.38,1)),
             (0.7, (0.80,0.72,0.60,1)), (1.0, (0.94,0.90,0.80,1))])
    nt.links.new(r.outputs["Color"], bsdf.inputs["Base Color"])
    inp(bsdf, ["Roughness"], 0.95); nt.links.new(n.outputs["Fac"], bsdf.inputs["Alpha"])
    inp(bsdf, ["Alpha"], 0.7)
    ring.data.materials.append(rm)

# fundo: nebulosa, estrelas, sol
bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=32, radius=40, location=(0,0,0))
bg = bpy.context.active_object; bg.name = "Nebula"
bm, nt, out = mat("nebula")
em = nt.nodes.new("ShaderNodeEmission")
tc, mp = mapping(nt, 0.3)
n = noise(nt, mp.outputs["Vector"], 1.3, 8, 0.6, SEED*0.7)
r = nt.nodes.new("ShaderNodeValToRGB"); nt.links.new(n.outputs["Fac"], r.inputs["Fac"])
ramp(r, [(0.0, (0.0,0.0,0.004,1)), (0.5, (0.004,0.006,0.015,1)),
         (0.7, (0.015,0.008,0.04,1)), (0.85, (0.04,0.02,0.08,1)), (1.0, (0.08,0.05,0.14,1))])
nt.links.new(r.outputs["Color"], em.inputs["Color"]); em.inputs["Strength"].default_value = 0.3
nt.links.new(em.outputs[0], out.inputs["Surface"]); bg.data.materials.append(bm)
bg.visible_shadow = False

stars = []
for i in range(140):
    u, v = random.uniform(0, 2*math.pi), math.acos(random.uniform(-1,1))
    loc = (35*math.sin(v)*math.cos(u), 35*math.sin(v)*math.sin(u), 35*math.cos(v))
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=random.uniform(0.010,0.030), location=loc)
    s = bpy.context.active_object
    sm, nt2, out2 = mat(f"star{i}")
    e2 = nt2.nodes.new("ShaderNodeEmission"); e2.inputs["Color"].default_value = (1,1,1,1)
    e2.inputs["Strength"].default_value = random.uniform(3,12)
    nt2.links.new(e2.outputs[0], out2.inputs["Surface"])
    s.data.materials.append(sm); stars.append(s)
bpy.ops.object.select_all(action="DESELECT")
for s in stars: s.select_set(True)
bpy.context.view_layer.objects.active = stars[0]
bpy.ops.object.join()

bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=0.9, location=(-9, 7, 6))
sun = bpy.context.active_object
sm, nt, out = mat("sun")
e = nt.nodes.new("ShaderNodeEmission"); e.inputs["Color"].default_value = (1.0,0.92,0.8,1)
e.inputs["Strength"].default_value = 30
nt.links.new(e.outputs[0], out.inputs["Surface"]); sun.data.materials.append(sm)
sun.visible_shadow = False

# luz
bpy.ops.object.empty_add(location=(0,0,0)); target = bpy.context.active_object
def area(name, loc, energy, size, color):
    bpy.ops.object.light_add(type="AREA", location=loc)
    o = bpy.context.active_object; o.name = name
    o.data.energy = energy; o.data.size = size; o.data.color = color
    c = o.constraints.new("TRACK_TO"); c.target = target
    c.track_axis = "TRACK_NEGATIVE_Z"; c.up_axis = "UP_Y"
area("Key", (4.2, -1.2, 1.4), 2600, 0.5, (1.0,0.94,0.85))
area("Fill", (-3.6, -1.6, 0.4), 20, 4.0, (0.4,0.4,0.4))
area("Rim", (0.4, 3.4, 1.2), 220, 2.0, (0.5,0.7,1.0))

# câmera
if CAM == "closeup":
    bpy.ops.object.camera_add(location=(0.2, -2.15, 0.55)); lens = 75
elif CAM == "probe":
    bpy.ops.object.camera_add(location=(-2.8, -3.2, 1.1)); lens = 38
else:
    bpy.ops.object.camera_add(location=(0, -4.6, 0.35)); lens = 55
cam = bpy.context.active_object; cam.data.lens = lens
c = cam.constraints.new("TRACK_TO"); c.target = target
c.track_axis = "TRACK_NEGATIVE_Z"; c.up_axis = "UP_Y"
sc.camera = cam

bpy.ops.render.render(write_still=True)
print("OK", OUT)
