#!/usr/bin/env python3
"""Gera mapas procedurais equiretangulares de um planeta (sem IA).

  python3 gen_maps.py --type desert --seed 7 --out renders/planets/deserto

Saída: albedo.png, height.png (16-bit), rough.png, cloud_low.png,
cloud_high.png, lights.png. Tamanho padrão 4096x2048.
"""
import argparse, os, math
import numpy as np
from PIL import Image, ImageFilter

def fbm(rng, w, h, octaves=7, base=4, persistence=0.55, lacunarity=2.0):
    total = np.zeros((h, w), np.float32); amp = 1.0; norm = 0.0
    for o in range(octaves):
        gh = max(2, int(base * lacunarity ** o)); gw = gh * 2
        g = rng.random((gh, gw), dtype=np.float32)
        img = Image.fromarray((g * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
        total += amp * (np.asarray(img, np.float32) / 255.0)
        norm += amp; amp *= persistence
    return total / norm

def ridged(rng, w, h, **kw):
    return 1.0 - np.abs(2.0 * fbm(rng, w, h, **kw) - 1.0)

def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a + 1e-6), 0, 1)
    return t * t * (3 - 2 * t)

def norm(a):
    lo, hi = float(a.min()), float(a.max())
    return (a - lo) / (hi - lo + 1e-6)

def bilinear(a, x, y):
    H, W = a.shape
    x = np.clip(x, 0, W - 1.001); y = np.clip(y, 0, H - 1.001)
    x0 = np.floor(x).astype(np.int32); y0 = np.floor(y).astype(np.int32)
    x1 = x0 + 1; y1 = y0 + 1
    fx = x - x0; fy = y - y0
    return (a[y0, x0] * (1 - fx) * (1 - fy) + a[y0, x1] * fx * (1 - fy) +
            a[y1, x0] * (1 - fx) * fy + a[y1, x1] * fx * fy)

def domain_warp(h, rng, amount=0.035):
    H, W = h.shape
    wx = (fbm(rng, W, H, octaves=4, base=2, persistence=0.6) - 0.5) * (W * amount * 2)
    wy = (fbm(rng, W, H, octaves=4, base=2, persistence=0.6) - 0.5) * (H * amount * 2)
    yy, xx = np.mgrid[0:H, 0:W]
    return bilinear(h, xx + wx, yy + wy)

def thermal(h, passes=3, talus=0.018):
    for _ in range(passes):
        for axis, shift in ((0, 1), (0, -1), (1, 1), (1, -1)):
            nb = np.roll(h, shift, axis=axis)
            diff = h - nb
            move = np.where(diff > talus, (diff - talus) * 0.5, 0.0)
            h = h - move * 0.5 + np.roll(move, -shift, axis=axis) * 0.5
    return h

def add_craters(h, rng, count=280):
    H, W = h.shape
    for _ in range(count):
        r = int(rng.integers(5, 38))
        cx, cy = int(rng.integers(r, W - r)), int(rng.integers(r, H - r))
        y0, y1 = max(0, cy - r * 2), min(H, cy + r * 2)
        x0, x1 = max(0, cx - r * 2), min(W, cx + r * 2)
        yy, xx = np.mgrid[y0:y1, x0:x1]
        d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / float(r)
        depth = rng.uniform(0.05, 0.14)
        h[y0:y1, x0:x1] -= depth * np.exp(-(d ** 2) * 2.8)
        h[y0:y1, x0:x1] += depth * 0.8 * np.exp(-(((d - 0.92) / 0.09) ** 2))

def city_lights(h, rng, sea=0.0, clusters=160):
    H, W = h.shape
    m = np.zeros((H, W), np.float32)
    for _ in range(clusters):
        cx = cy = None
        for _try in range(24):
            x, y = int(rng.integers(0, W)), int(rng.integers(int(H*0.10), int(H*0.90)))
            if h[y, x] > sea + 0.015:
                cx, cy = x, y; break
        if cx is None:
            continue
        big = rng.random() < 0.25
        rad = rng.uniform(5.0, 14.0) if big else rng.uniform(1.5, 4.5)
        inten = rng.uniform(0.45, 1.0) * (1.3 if big else 0.75)
        r = int(max(3, rad * 3))
        y0, y1 = max(0, cy-r), min(H, cy+r); x0, x1 = max(0, cx-r), min(W, cx+r)
        yy, xx = np.mgrid[y0:y1, x0:x1]
        d = np.sqrt((xx-cx)**2 + (yy-cy)**2) / rad
        m[y0:y1, x0:x1] += inten * np.exp(-(d**2) * 2.2)
        # satélites: bairros menores
        for _ in range(int(rng.integers(3, 13))):
            sx = int(np.clip(cx + rng.normal(0, rad*2.5), 0, W-1))
            sy = int(np.clip(cy + rng.normal(0, rad*2.0), 0, H-1))
            if h[sy, sx] <= sea + 0.01:
                continue
            sr = rng.uniform(0.8, 2.8); si = rng.uniform(0.2, 0.75)
            rr = int(max(2, sr*3))
            y0, y1 = max(0, sy-rr), min(H, sy+rr); x0, x1 = max(0, sx-rr), min(W, sx+rr)
            yy, xx = np.mgrid[y0:y1, x0:x1]
            d = np.sqrt((xx-sx)**2 + (yy-sy)**2) / sr
            m[y0:y1, x0:x1] += si * np.exp(-(d**2) * 2.0)
    img = Image.fromarray((np.clip(m, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7))
    return np.asarray(img, np.float32) / 255.0

def save_gray(a, path, bits=8):
    if bits == 16:
        Image.fromarray((np.clip(a, 0, 1) * 65535).astype(np.uint16)).save(path)
    else:
        Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).save(path)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--type", default="desert", choices=["desert", "terra", "ice", "gas"])
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--size", default="4096x2048")
    ap.add_argument("--out", default="renders/planets/deserto")
    a = ap.parse_args()
    W, H = (int(v) for v in a.size.lower().split("x"))
    os.makedirs(a.out, exist_ok=True)
    rng = np.random.default_rng(a.seed)

    if a.type == "gas":
        lat = np.linspace(-1, 1, H, dtype=np.float32)[:, None]
        bands = np.sin(lat * 11 + 0.6 * np.sin(lat * 4)) * 0.5 + 0.5
        warp = fbm(rng, W, H, octaves=6, base=6)
        v = norm(bands * 0.7 + warp * 0.3)
        col = np.zeros((H, W, 3), np.float32)
        for i, (p, c) in enumerate([(0.0, (0.10, 0.05, 0.02)), (0.3, (0.42, 0.20, 0.08)),
                                    (0.55, (0.72, 0.45, 0.20)), (0.8, (0.90, 0.74, 0.48)),
                                    (1.0, (0.97, 0.92, 0.78))]):
            pass
        stops = [(0.0, (0.10,0.05,0.02)), (0.3, (0.42,0.20,0.08)), (0.55, (0.72,0.45,0.20)),
                 (0.8, (0.90,0.74,0.48)), (1.0, (0.97,0.92,0.78))]
        for c in range(3):
            xs = [s[0] for s in stops]; ys = [s[1][c] for s in stops]
            col[:, :, c] = np.interp(v, xs, ys)
        Image.fromarray((col * 255).astype(np.uint8)).save(os.path.join(a.out, "albedo.png"))
        save_gray(np.full((H, W), 0.5, np.float32), os.path.join(a.out, "height.png"), 16)
        save_gray(np.full((H, W), 0.95, np.float32), os.path.join(a.out, "rough.png"))
        for n in ("cloud_low", "cloud_high", "lights"):
            save_gray(np.zeros((H, W), np.float32), os.path.join(a.out, n + ".png"))
        print("ok", a.out); return

    base = fbm(rng, W, H, octaves=9, base=3, persistence=0.68)
    mount = ridged(rng, W, H, octaves=9, base=6, persistence=0.62)
    fine = fbm(rng, W, H, octaves=8, base=16, persistence=0.65)
    fine2 = fbm(rng, W, H, octaves=8, base=12, persistence=0.70)
    ridge2 = ridged(rng, W, H, octaves=8, base=26, persistence=0.58)
    moist = fbm(rng, W, H, octaves=6, base=4, persistence=0.6)
    # macroforma: planície / planalto / montanha
    macro = norm(fbm(rng, W, H, octaves=5, base=1.5, persistence=0.55))
    mask = smoothstep(0.52, 0.68, macro)
    plains = norm(base * 0.6 + fine * 0.4) * 0.34
    mountain = norm(mount * 0.65 + ridge2 * 0.35)
    h = plains * (1 - mask) + (0.42 + 0.58 * mountain) * mask
    # cânion acompanhando a contour da macroforma
    canyon = 1 - smoothstep(0.0, 0.018, np.abs(macro - 0.5))
    h -= canyon * 0.05
    # rede de drenagem (contornos de um ruído distorcido)
    vn = domain_warp(fbm(rng, W, H, octaves=5, base=10, persistence=0.55), rng, 0.02)
    chan = (1 - smoothstep(0.0, 0.03, np.abs(vn - 0.5))) * (1 - smoothstep(0.45, 0.6, h))
    h -= chan * 0.02
    add_craters(h, rng, count=180 if a.type != "ice" else 90)
    h = norm(h)
    h = domain_warp(h, rng, amount=0.012)
    h = norm(h)

    lat = np.linspace(-1, 1, H, dtype=np.float32)[:, None]
    lat = np.broadcast_to(lat, (H, W))
    if a.type == "terra":
        sea = 0.48
        land = smoothstep(sea - 0.03, sea + 0.03, h)
        depth = np.clip((sea - h) / sea, 0, 1)
    elif a.type == "ice":
        sea = 0.0; land = np.ones_like(h)
        depth = np.zeros_like(h)
    else:
        sea = 0.0; land = np.ones_like(h); depth = np.zeros_like(h)

    # albedo
    col = np.zeros((H, W, 3), np.float32)
    if a.type == "desert":
        stops_h = [(0.0, (0.02,0.015,0.012)), (0.30, (0.10,0.05,0.035)), (0.50, (0.22,0.10,0.06)),
                   (0.68, (0.38,0.20,0.12)), (0.82, (0.55,0.38,0.24)), (0.92, (0.72,0.60,0.46)), (1.0, (0.88,0.84,0.78))]
        for c in range(3):
            col[:, :, c] = np.interp(h, [s[0] for s in stops_h], [s[1][c] for s in stops_h])
        # variação de umidade/rocha
        rock = smoothstep(0.55, 0.75, moist)
        col = col * (1 - 0.25 * rock[..., None]) + np.array([0.12,0.10,0.09]) * (0.25 * rock[..., None])
        # veios de drenagem e cânion (só leve, para não marcar linha)
        chv = chan * land
        col = col * (1 - 0.12 * chv[..., None]) + np.array([0.06,0.04,0.03]) * (0.12 * chv[..., None])
        ice = smoothstep(0.80, 0.96, np.abs(lat) + (fbm(rng, W, H, octaves=5, base=6, persistence=0.6) - 0.5) * 0.10)
        col = col * (1 - ice[..., None]) + np.array([0.84,0.90,0.96]) * ice[..., None]
        rough = 0.82 + 0.12 * h
    elif a.type == "terra":
        ocean = np.array([0.004,0.020,0.055]) * (1 - depth[..., None]) + np.array([0.02,0.10,0.22]) * depth[..., None]
        landc = np.zeros((H, W, 3), np.float32)
        stops_l = [(0.48, (0.06,0.14,0.05)), (0.55, (0.18,0.30,0.10)), (0.65, (0.38,0.34,0.18)),
                   (0.75, (0.55,0.46,0.28)), (0.86, (0.72,0.68,0.58)), (0.94, (0.90,0.92,0.95))]
        for c in range(3):
            landc[:, :, c] = np.interp(h, [s[0] for s in stops_l], [s[1][c] for s in stops_l])
        dry = smoothstep(0.35, 0.65, moist)
        landc = landc * (1 - 0.35 * dry[..., None]) + np.array([0.55,0.42,0.24]) * (0.35 * dry[..., None])
        col = ocean * (1 - land[..., None]) + landc * land[..., None]
        ice = smoothstep(0.80, 0.96, np.abs(lat) + (fbm(rng, W, H, octaves=5, base=6, persistence=0.6) - 0.5) * 0.10)
        col = col * (1 - ice[..., None]) + np.array([0.84,0.90,0.96]) * ice[..., None]
        rough = (0.15 * (1 - land) + 0.85 * land) + 0.08 * h
    else:  # ice
        v = norm(h * 0.6 + fbm(rng, W, H, octaves=5, base=9) * 0.4)
        cr = ridged(rng, W, H, octaves=6, base=12)
        col[:, :, 0] = 0.55 + 0.35 * v; col[:, :, 1] = 0.72 + 0.25 * v; col[:, :, 2] = 0.85 + 0.14 * v
        col = col * (1 - 0.2 * cr[..., None]) + np.array([0.35,0.55,0.72]) * (0.2 * cr[..., None])
        rough = 0.55 + 0.2 * v

    h_map = h.copy()
    if a.type in ("terra", "desert"):
        h_map = np.where(h < sea, sea + (h - sea) * 0.12, h)
    grain = (fine2 - 0.5) * 0.15
    col = np.clip(col + grain[..., None], 0, 1)
    # alto ganho local: realça a textura sem mexer nas formas grandes
    hb = np.asarray(Image.fromarray((h_map*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2)), np.float32)/255.0
    hs = np.clip(h_map + (h_map - hb) * 4.0, 0, 1)
    col = np.clip(col * (0.82 + 0.35 * (hs - hb)[..., None]), 0, 1)
    img = Image.fromarray((np.clip(col,0,1) * 255).astype(np.uint8)).filter(ImageFilter.UnsharpMask(radius=2, percent=220, threshold=1))
    img.save(os.path.join(a.out, "albedo.png"))
    save_gray(h_map, os.path.join(a.out, "height.png"), 16)
    save_gray(norm(rough), os.path.join(a.out, "rough.png"))
    save_gray(np.zeros((H, W), np.float32) if a.type != "terra" else 1.0 - land, os.path.join(a.out, "water.png"))
    dx = np.gradient(hs, axis=1); dy = np.gradient(hs, axis=0)
    nx = -dx * 6.0; ny = -dy * 6.0; nz = np.ones_like(hs)
    ln = np.sqrt(nx*nx + ny*ny + nz*nz)
    nrm = np.stack([(nx/ln+1)*0.5, (ny/ln+1)*0.5, (nz/ln+1)*0.5], axis=-1)
    Image.fromarray((np.clip(nrm,0,1)*255).astype(np.uint8)).save(os.path.join(a.out, "normal.png"))

    # nuvens: duas camadas, faixas latitudinais
    c1 = fbm(rng, W, H, octaves=9, base=10, persistence=0.62)
    c2 = fbm(rng, W, H, octaves=9, base=20, persistence=0.58)
    band = 0.6 + 0.4 * np.cos(lat * math.pi * 2.2)
    cl = smoothstep(0.50, 0.82, c1 * band) * (0.60 if a.type == "desert" else 0.80)
    ch = smoothstep(0.56, 0.86, c2 * band) * (0.35 if a.type == "desert" else 0.50)
    save_gray(cl, os.path.join(a.out, "cloud_low.png"))
    save_gray(ch, os.path.join(a.out, "cloud_high.png"))

    lights = city_lights(h, rng, sea) if a.type != "ice" else np.zeros((H, W), np.float32)
    save_gray(lights, os.path.join(a.out, "lights.png"))
    print("ok", a.out, "h", h.shape, "sea", sea)

if __name__ == "__main__":
    main()
