#!/usr/bin/env python3
"""Lote de arte do SnA no ComfyUI do hal9000 (FLUX.2 Klein 4B distilled).

Lê jobs.json, gera N seeds por ficha, salva em renders/sna-art/batch-<n>/
e monta um contact.html para curadoria. Só stdlib — roda com o python3 do Mac.

  python3 scripts/comfy/run.py --batch 1 --dry-run
  python3 scripts/comfy/run.py --batch 1
  python3 scripts/comfy/run.py --batch 1 --only cripter,holodisco --seeds 2
"""
import argparse
import html
import json
import os
import sys
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path

HOST = "http://100.87.148.94:8188"
UNET = "flux-2-klein-4b-fp8.safetensors"
CLIP = "qwen_3_4b.safetensors"
VAE = "flux2-vae.safetensors"
ROOT = Path(__file__).resolve().parents[2]
JOBS = Path(__file__).with_name("jobs.json")


def get(host, path, timeout=30):
    with urllib.request.urlopen(host + path, timeout=timeout) as r:
        return json.loads(r.read().decode())


def post(host, path, payload):
    req = urllib.request.Request(
        host + path, data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode())


def upload(host, path):
    boundary = uuid.uuid4().hex
    # nome ASCII: o original pode ter acento/espaço (Google Drive) e o multipart
    # não negocia isso bem com todo servidor
    suffix = Path(path).suffix.lower() or ".png"
    name = f"ref-{uuid.uuid4().hex[:8]}{suffix}"
    mime = "image/webp" if suffix == ".webp" else "image/png"
    body = b""
    body += f"--{boundary}\r\n".encode()
    body += b'Content-Disposition: form-data; name="image"; filename="' + name.encode() + b'"\r\n'
    body += f"Content-Type: {mime}\r\n\r\n".encode()
    body += open(path, "rb").read() + b"\r\n"
    body += f"--{boundary}\r\n".encode()
    body += b'Content-Disposition: form-data; name="overwrite"\r\n\r\ntrue\r\n'
    body += f"--{boundary}--\r\n".encode()
    req = urllib.request.Request(
        host + "/upload/image", data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.loads(r.read().decode())["name"]


def graph(prompt, size, seed, steps, image=None, denoise=0.6):
    w, h = size
    g = {
        "70": {"class_type": "UNETLoader", "inputs": {"unet_name": UNET, "weight_dtype": "default"}},
        "71": {"class_type": "CLIPLoader", "inputs": {"clip_name": CLIP, "type": "flux2", "device": "cpu"}},
        "72": {"class_type": "VAELoader", "inputs": {"vae_name": VAE}},
        "74": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt, "clip": ["71", 0]}},
        "76": {"class_type": "ConditioningZeroOut", "inputs": {"conditioning": ["74", 0]}},
        "65": {"class_type": "VAEDecode", "inputs": {"samples": ["82", 0], "vae": ["72", 0]}},
        "9": {"class_type": "SaveImage", "inputs": {"images": ["65", 0], "filename_prefix": "sna-art"}},
    }
    if image:
        g["80"] = {"class_type": "LoadImage", "inputs": {"image": image}}
        g["81"] = {"class_type": "VAEEncode", "inputs": {"pixels": ["80", 0], "vae": ["72", 0]}}
        latent = ["81", 0]
    else:
        g["66"] = {"class_type": "EmptyFlux2LatentImage",
                   "inputs": {"width": w, "height": h, "batch_size": 1}}
        latent = ["66", 0]
    g["82"] = {"class_type": "KSampler", "inputs": {
        "model": ["70", 0], "positive": ["74", 0], "negative": ["76", 0],
        "latent_image": latent, "seed": seed, "steps": steps, "cfg": 1.0,
        "sampler_name": "euler", "scheduler": "simple",
        "denoise": 1.0 if not image else denoise}}
    return g


def wait_for(host, pid, out, timeout=900):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            entry = get(host, f"/history/{pid}").get(pid, {})
        except urllib.error.HTTPError:
            entry = {}
        status = entry.get("status", {})
        if status.get("completed"):
            for _node, items in entry.get("outputs", {}).items():
                for img in items.get("images", []):
                    url = (f"{host}/view?filename={img['filename']}"
                           f"&subfolder={img.get('subfolder', '')}&type={img['type']}")
                    urllib.request.urlretrieve(url, out)
                    return out
            raise RuntimeError("job concluído sem imagem")
        if status.get("status_str") == "error":
            raise RuntimeError(f"job falhou: {status}")
        time.sleep(2)
    raise RuntimeError("timeout esperando o job")


def contact_html(results, out_dir, title):
    jobs = {}
    for row in results:
        jobs.setdefault(row["job"], []).append(row)
    blocks = []
    for job_id, rows in jobs.items():
        r0 = rows[0]
        imgs = "\n".join(
            f'<a href="{html.escape(r["file"])}" target="_blank" rel="noopener">'
            f'<img src="{html.escape(r["file"])}" alt="{html.escape(r["title"])} seed {r["seed"]}">'
            f'<span>seed {r["seed"]}</span></a>' for r in rows)
        blocks.append(f"""
        <section>
          <h2>{html.escape(r0['title'])} <small>{html.escape(r0['category'])} · {r0['size'][0]}×{r0['size'][1]} · {r0['steps']} steps</small></h2>
          <p class="prompt">{html.escape(r0['prompt'])}</p>
          <div class="grid">{imgs}</div>
        </section>""")
    doc = f"""<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<title>{html.escape(title)}</title>
<style>
  body {{ margin:0; padding:24px; background:#0b0f14; color:#e1e7ed; font:14px/1.45 -apple-system,Segoe UI,Roboto,sans-serif; }}
  h1 {{ font-size:24px; margin:0 0 20px; }}
  section {{ margin:0 0 34px; padding-top:18px; border-top:1px solid #263544; }}
  h2 {{ font-size:18px; margin:0 0 4px; }}
  h2 small {{ color:#8b949e; font-weight:400; font-size:12px; }}
  .prompt {{ color:#8b949e; font-size:12px; margin:0 0 12px; max-width:110ch; }}
  .grid {{ display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; }}
  a {{ display:block; text-decoration:none; color:#8b949e; }}
  img {{ width:100%; border:1px solid #263544; border-radius:6px; display:block; background:#d6d6d6; }}
  span {{ display:block; font-size:11px; padding:4px 2px; }}
</style></head><body>
<h1>{html.escape(title)}</h1>
{''.join(blocks)}
</body></html>"""
    path = out_dir / "contact.html"
    path.write_text(doc, encoding="utf-8")
    return path


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--batch", type=int, default=1)
    p.add_argument("--jobs", default=str(JOBS))
    p.add_argument("--only", default="")
    p.add_argument("--seeds", type=int, default=0, help="usa só as N primeiras seeds de cada ficha")
    p.add_argument("--steps", type=int, default=0, help="sobrescreve os steps")
    p.add_argument("--out", default="")
    p.add_argument("--host", default=HOST)
    p.add_argument("--dry-run", action="store_true")
    a = p.parse_args()

    spec = json.load(open(a.jobs, encoding="utf-8"))
    style = spec.get("style", "")
    jobs = [j for j in spec["jobs"] if j.get("batch") == a.batch]
    wanted = {s.strip() for s in a.only.split(",") if s.strip()}
    if wanted:
        jobs = [j for j in jobs if j["id"] in wanted]
    if not jobs:
        sys.exit(f"nenhuma ficha no lote {a.batch}" + (f" (filtro: {a.only})" if a.only else ""))
    for j in jobs:
        w, h = j["size"]
        if w % 16 or h % 16:
            sys.exit(f"{j['id']}: size {w}x{h} não é múltiplo de 16")
        if j.get("ref") and not Path(j["ref"]).exists():
            sys.exit(f"{j['id']}: referência não existe: {j['ref']}")

    out_dir = Path(a.out) if a.out else ROOT / "renders" / "sna-art" / f"batch-{a.batch}"
    if a.dry_run:
        for j in jobs:
            seeds = j["seeds"][: a.seeds or None]
            steps = a.steps or j["steps"]
            print(f"\n[{j['batch']}] {j['id']} — {j['title']} · {j['size'][0]}×{j['size'][1]} · {steps} steps · {len(seeds)} seeds")
            print("  " + ", ".join(str(s) for s in seeds))
            print("  prompt:", f"{j['prompt']}, {style}")
            if j.get("ref"):
                print(f"  img2img: {j['ref']} (denoise {j.get('denoise', 0.6)})")
        print(f"\n{len(jobs)} ficha(s), {sum(len(j['seeds'][: a.seeds or None]) for j in jobs)} imagens → {out_dir}")
        return

    try:
        get(a.host, "/system_stats", timeout=5)
    except Exception as e:
        sys.exit(f"hal9000/ComfyUI offline em {a.host}: {e}\n"
                 "Ligue o hal9000 e confirme: infra hal status")

    out_dir.mkdir(parents=True, exist_ok=True)
    results = []
    total = sum(len(j["seeds"][: a.seeds or None]) for j in jobs)
    n = 0
    t0 = time.time()
    for j in jobs:
        job_dir = out_dir / j["id"]
        job_dir.mkdir(parents=True, exist_ok=True)
        steps = a.steps or j["steps"]
        ref_name = None
        if j.get("ref"):
            ref_name = upload(a.host, j["ref"])
            print(f"[{j['id']}] base: {Path(j['ref']).name} (denoise {j.get('denoise', 0.6)})")
        for seed in j["seeds"][: a.seeds or None]:
            n += 1
            prompt = f"{j['prompt']}, {style}"
            out = job_dir / f"seed-{seed}.png"
            print(f"[{n}/{total}] {j['id']} seed {seed} …", end=" ", flush=True)
            t = time.time()
            job = post(a.host, "/prompt", {"prompt": graph(prompt, j["size"], seed, steps, ref_name, j.get("denoise", 0.6))})
            wait_for(a.host, job["prompt_id"], out)
            print(f"{time.time() - t:.0f}s → {out.relative_to(out_dir)}")
            results.append({
                "job": j["id"], "title": j["title"], "category": j["category"],
                "seed": seed, "steps": steps, "size": j["size"],
                "file": str(out.relative_to(out_dir)), "prompt": prompt,
                "ref": j.get("ref"), "denoise": j.get("denoise"),
            })

    (out_dir / "results.json").write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    contact = contact_html(results, out_dir, f"SnA · lote {a.batch}")
    print(f"\n{len(results)} imagens em {time.time() - t0:.0f}s → {out_dir}")
    print(f"contato: {contact}")


if __name__ == "__main__":
    main()
