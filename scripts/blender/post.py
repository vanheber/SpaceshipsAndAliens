import sys
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance

src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert("RGB")
a = np.asarray(im, np.float32) / 255.0

# bloom: extrai altas luzes, borra e soma em screen
lum = a.max(axis=2)
bright = np.clip((lum - 0.62) / 0.38, 0, 1)[..., None] * a
bl = np.asarray(Image.fromarray((bright * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(8)), np.float32) / 255.0
a = 1 - (1 - a) * (1 - bl * 0.28)

# contraste e saturação
im = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))
im = ImageEnhance.Contrast(im).enhance(1.12)
im = ImageEnhance.Color(im).enhance(1.08)
im = ImageEnhance.Brightness(im).enhance(0.96)
im = im.filter(ImageFilter.UnsharpMask(radius=1.2, percent=180, threshold=1))

# vinheta
w, h = im.size
yy, xx = np.mgrid[0:h, 0:w]
cx, cy = w / 2, h / 2
r = np.sqrt(((xx - cx) / (w * 0.72)) ** 2 + ((yy - cy) / (h * 0.72)) ** 2)
v = np.clip(1 - 0.55 * np.clip(r - 0.45, 0, 1) ** 1.6, 0, 1)[..., None]
a = np.asarray(im, np.float32) / 255.0 * v

# grão discreto
rng = np.random.default_rng(7)
a = np.clip(a + rng.normal(0, 0.008, a.shape).astype(np.float32), 0, 1)
Image.fromarray((a * 255).astype(np.uint8)).save(dst)
print("OK", dst)
