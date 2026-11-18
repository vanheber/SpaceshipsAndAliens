"""Renderiza um planeta a partir dos mapas procedurais (sem IA)."""
import bpy, math, random, sys, os

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
def arg(k, d=None): return argv[argv.index(k) + 1] if k in argv else d
MAPS = arg("--maps", "/root/maps/deserto")
OUT = arg("--out", "/tmp/planet.png")
SIZE = int(arg("--size", "1024"))
SAMPLES = int(arg("--samples", "160"))
CAM = arg("--camera", "full")
SEED = int(arg("--seed", "7"))
random.seed(SEED)

def load(name, color=False):
    p = os.path.join(MAPS, name)
    img = bpy.data.images.load(p, check_existing=True)
    img.colorspace_settings.name = "sRGB" if color else "Non-Color"
    return img

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = "CYCLES"; sc.cycles.device = "GPU"
try:
    p = bpy.context.preferences.addons["cycles"].preferences
    p.compute_device_type = "CUDA"; p.get_devices()
    for d in p.devices: d.use = d.type == "CUDA"
except Exception as e: print("GPU:", e)
sc.cycles.samples = SAMPLES; sc.cycles.use_denoising = True
sc.render.resolution_x = sc.render.resolution_y = SIZE
sc.render.resolution_percentage = 100
sc.render.image_settings.file_format = "PNG"
sc.render.image_settings.color_mode = "RGB"
sc.render.filepath = OUT
sc.view_settings.view_transform = "AgX"
sc.view_settings.exposure = 0.0
try: sc.view_settings.look = "AgX - Medium High Contrast"
except Exception: pass

def inp(n, names, v):
    for x in names:
        if x in n.inputs: n.inputs[x].default_value = v; return

def mat(name):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    return m, nt, out

# superfície
m, nt, out = mat("surface")
bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
nt.links.new(bsdf.outputs[0], out.inputs["Surface"])
tex = nt.nodes.new("ShaderNodeTexImage"); tex.image = load("albedo.png", True); tex.interpolation = "Cubic"
rough = nt.nodes.new("ShaderNodeTexImage"); rough.image = load("rough.png")
nt.links.new(rough.outputs["Color"], bsdf.inputs["Roughness"])
himg = nt.nodes.new("ShaderNodeTexImage"); himg.image = load("height.png"); himg.interpolation = "Cubic"
bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 1.5
nt.links.new(himg.outputs["Color"], bump.inputs["Height"])
inp(bsdf, ["Specular IOR Level", "Specular"], 0.9)

nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
inp(bsdf, ["Specular IOR Level", "Specular"], 0.45)

# luzes noturnas
sunv = nt.nodes.new("ShaderNodeCombineXYZ")
sunv.inputs[0].default_value = 0.86; sunv.inputs[1].default_value = -0.25; sunv.inputs[2].default_value = 0.44
geo = nt.nodes.new("ShaderNodeNewGeometry")
dot = nt.nodes.new("ShaderNodeVectorMath"); dot.operation = "DOT_PRODUCT"
nt.links.new(geo.outputs["Normal"], dot.inputs[0]); nt.links.new(sunv.outputs["Vector"], dot.inputs[1])
mr = nt.nodes.new("ShaderNodeMapRange"); nt.links.new(dot.outputs["Value"], mr.inputs["Value"])
mr.inputs["From Min"].default_value = -1; mr.inputs["From Max"].default_value = 1
nr = nt.nodes.new("ShaderNodeValToRGB"); nt.links.new(mr.outputs["Result"], nr.inputs["Fac"])
nr.color_ramp.elements[0].position = 0.0; nr.color_ramp.elements[0].color = (1,1,1,1)
nr.color_ramp.elements[1].position = 0.48; nr.color_ramp.elements[1].color = (0,0,0,1)
li = nt.nodes.new("ShaderNodeTexImage"); li.image = load("lights.png")
mul = nt.nodes.new("ShaderNodeMixRGB"); mul.blend_type = "MULTIPLY"; mul.inputs["Fac"].default_value = 1.0
nt.links.new(li.outputs["Color"], mul.inputs["Color1"]); nt.links.new(nr.outputs["Color"], mul.inputs["Color2"])
st = nt.nodes.new("ShaderNodeMath"); st.operation = "MULTIPLY"; st.inputs[1].default_value = 5.0
nt.links.new(mul.outputs["Color"], st.inputs[0])
inp(bsdf, ["Emission Color"], (1.0, 0.55, 0.22, 1))
nt.links.new(st.outputs[0], bsdf.inputs["Emission Strength"])

# planeta
bpy.ops.mesh.primitive_uv_sphere_add(segments=256, ring_count=128, radius=1.0, location=(0,0,0))
planet = bpy.context.active_object; planet.name = "Planet"
bpy.ops.object.shade_smooth(); planet.data.materials.append(m)
sub = planet.modifiers.new("sub", "SUBSURF"); sub.levels = 2; sub.render_levels = 2
dtex = bpy.data.textures.new("h", type="IMAGE"); dtex.image = load("height.png"); dtex.extension = "EXTEND"
dm = planet.modifiers.new("disp", "DISPLACE"); dm.texture = dtex; dm.texture_coords = "UV"
dm.strength = 0.012; dm.mid_level = 0.5

def cloud_shell(radius, name, fname, alpha):
    cm, cnt, cout = mat(name)
    b = cnt.nodes.new("ShaderNodeBsdfPrincipled"); cnt.links.new(b.outputs[0], cout.inputs["Surface"])
    t = cnt.nodes.new("ShaderNodeTexImage"); t.image = load(fname); t.interpolation = "Cubic"
    cnt.links.new(t.outputs["Color"], b.inputs["Alpha"])
    inp(b, ["Base Color"], (1,1,1,1)); inp(b, ["Roughness"], 0.95); inp(b, ["Alpha"], alpha)
    bp = cnt.nodes.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = 0.4
    cnt.links.new(t.outputs["Color"], bp.inputs["Height"]); cnt.links.new(bp.outputs["Normal"], b.inputs["Normal"])
    bpy.ops.mesh.primitive_uv_sphere_add(segments=192, ring_count=96, radius=radius, location=(0,0,0))
    o = bpy.context.active_object; o.name = name; bpy.ops.object.shade_smooth(); o.data.materials.append(cm)
    o.visible_shadow = False
    return o

cloud_shell(1.012, "CloudsLow", "cloud_low.png", 0.30)
cloud_shell(1.018, "CloudsHigh", "cloud_high.png", 0.18)

# atmosfera volume
am, ant, aout = mat("atmo")
vol = ant.nodes.new("ShaderNodeVolumePrincipled")
cramp = ant.nodes.new("ShaderNodeValToRGB")
cramp.color_ramp.elements[0].position = 0.0; cramp.color_ramp.elements[0].color = (0.95, 0.72, 0.55, 1)
cramp.color_ramp.elements[1].position = 0.55; cramp.color_ramp.elements[1].color = (0.85, 0.42, 0.24, 1)
e_in = cramp.color_ramp.elements.new(1.0); e_in.color = (0.55, 0.20, 0.10, 1)
ant.links.new(mr.outputs["Result"], cramp.inputs["Fac"])
ant.links.new(cramp.outputs["Color"], vol.inputs["Color"])
vol.inputs["Anisotropy"].default_value = 0.72
tc = ant.nodes.new("ShaderNodeTexCoord")
ln = ant.nodes.new("ShaderNodeVectorMath"); ln.operation = "LENGTH"
ant.links.new(tc.outputs["Object"], ln.inputs[0])
mr = ant.nodes.new("ShaderNodeMapRange")
ant.links.new(ln.outputs["Value"], mr.inputs["Value"])
mr.inputs["From Min"].default_value = 1.0
mr.inputs["From Max"].default_value = 1.07
mr.inputs["To Min"].default_value = 1.0
mr.inputs["To Max"].default_value = 0.0
mr.clamp = True
n = ant.nodes.new("ShaderNodeTexNoise"); n.inputs["Scale"].default_value = 7.0
n.inputs["Detail"].default_value = 4.0
ant.links.new(tc.outputs["Object"], n.inputs["Vector"])
nmap = ant.nodes.new("ShaderNodeMapRange")
ant.links.new(n.outputs["Fac"], nmap.inputs["Value"])
nmap.inputs["To Min"].default_value = 0.5
nmap.inputs["To Max"].default_value = 1.6
pw = ant.nodes.new("ShaderNodeMath"); pw.operation = "POWER"; pw.inputs[1].default_value = 2.2
ant.links.new(mr.outputs["Result"], pw.inputs[0])
m1 = ant.nodes.new("ShaderNodeMath"); m1.operation = "MULTIPLY"
ant.links.new(pw.outputs[0], m1.inputs[0]); ant.links.new(nmap.outputs["Result"], m1.inputs[1])
# densidade direcional: mais espessa no lado iluminado
nrmv = ant.nodes.new("ShaderNodeVectorMath"); nrmv.operation = "NORMALIZE"
ant.links.new(tc.outputs["Object"], nrmv.inputs[0])
sunv = ant.nodes.new("ShaderNodeCombineXYZ")
sunv.inputs[0].default_value = 0.917; sunv.inputs[1].default_value = -0.262; sunv.inputs[2].default_value = 0.306
dot = ant.nodes.new("ShaderNodeVectorMath"); dot.operation = "DOT_PRODUCT"
ant.links.new(nrmv.outputs["Vector"], dot.inputs[0]); ant.links.new(sunv.outputs["Vector"], dot.inputs[1])
dmap = ant.nodes.new("ShaderNodeMapRange")
ant.links.new(dot.outputs["Value"], dmap.inputs["Value"])
dmap.inputs["From Min"].default_value = -1.0; dmap.inputs["From Max"].default_value = 1.0
dmap.inputs["To Min"].default_value = 0.0; dmap.inputs["To Max"].default_value = 5.5
dmap.clamp = True
dirm = ant.nodes.new("ShaderNodeMath"); dirm.operation = "MULTIPLY"
ant.links.new(m1.outputs[0], dirm.inputs[0]); ant.links.new(dmap.outputs["Result"], dirm.inputs[1])
m2 = ant.nodes.new("ShaderNodeMath"); m2.operation = "MULTIPLY"; m2.inputs[1].default_value = 0.12
ant.links.new(dirm.outputs[0], m2.inputs[0]); ant.links.new(m2.outputs[0], vol.inputs["Density"])
ant.links.new(vol.outputs[0], aout.inputs["Volume"])
bpy.ops.mesh.primitive_uv_sphere_add(segments=128, ring_count=64, radius=1.07, location=(0,0,0))
at = bpy.context.active_object; at.name = "Atmos"; at.data.materials.append(am); at.visible_shadow = False

# fundo
bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=32, radius=40, location=(0,0,0))
bg = bpy.context.active_object; bg.name = "Nebula"
bm, bnt, bout = mat("nebula")
em = bnt.nodes.new("ShaderNodeEmission")
tc2 = bnt.nodes.new("ShaderNodeTexCoord")
mp = bnt.nodes.new("ShaderNodeMapping"); bnt.links.new(tc2.outputs["Object"], mp.inputs["Vector"])
mp.inputs["Scale"].default_value = (0.3,0.3,0.3)
n = bnt.nodes.new("ShaderNodeTexNoise"); n.noise_dimensions = "4D"; n.inputs["Scale"].default_value = 1.3
n.inputs["Detail"].default_value = 8.0; n.inputs["W"].default_value = SEED*0.7
bnt.links.new(mp.outputs["Vector"], n.inputs["Vector"])
r = bnt.nodes.new("ShaderNodeValToRGB"); bnt.links.new(n.outputs["Fac"], r.inputs["Fac"])
for pos,col in [(0.0,(0.0,0.0,0.004,1)),(0.5,(0.004,0.006,0.015,1)),(0.7,(0.015,0.008,0.04,1)),(0.85,(0.04,0.02,0.08,1)),(1.0,(0.08,0.05,0.14,1))]:
    try: e = r.color_ramp.elements.new(pos); e.color = col
    except Exception: pass
r.color_ramp.elements[0].position = 0; r.color_ramp.elements[0].color = (0.0,0.0,0.004,1)
bnt.links.new(r.outputs["Color"], em.inputs["Color"]); em.inputs["Strength"].default_value = 0.3
bnt.links.new(em.outputs[0], bout.inputs["Surface"]); bg.data.materials.append(bm); bg.visible_shadow = False

stars = []
for i in range(140):
    u, v = random.uniform(0, 2*math.pi), math.acos(random.uniform(-1,1))
    loc = (35*math.sin(v)*math.cos(u), 35*math.sin(v)*math.sin(u), 35*math.cos(v))
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=random.uniform(0.010,0.030), location=loc)
    s = bpy.context.active_object
    sm, snt, sout = mat(f"star{i}")
    e2 = snt.nodes.new("ShaderNodeEmission"); e2.inputs["Color"].default_value = (1,1,1,1)
    e2.inputs["Strength"].default_value = random.uniform(3,12)
    snt.links.new(e2.outputs[0], sout.inputs["Surface"]); s.data.materials.append(sm); stars.append(s)
bpy.ops.object.select_all(action="DESELECT")
for s in stars: s.select_set(True)
bpy.context.view_layer.objects.active = stars[0]; bpy.ops.object.join()

# luz
bpy.ops.object.empty_add(location=(0,0,0)); target = bpy.context.active_object
def area(name, loc, energy, size, color):
    bpy.ops.object.light_add(type="AREA", location=loc)
    o = bpy.context.active_object; o.name = name
    o.data.energy = energy; o.data.size = size; o.data.color = color
    c = o.constraints.new("TRACK_TO"); c.target = target
    c.track_axis = "TRACK_NEGATIVE_Z"; c.up_axis = "UP_Y"
area("Key", (4.2, -1.2, 1.4), 2100, 0.5, (1.0,0.94,0.85))
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
c.track_axis = "TRACK_NEGATIVE_Z"; c.up_axis = "UP_Y"; sc.camera = cam

bpy.ops.render.render(write_still=True)
print("OK", OUT)
