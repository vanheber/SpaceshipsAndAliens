#!/usr/bin/env node
// Espelha a Biblioteca do Universo do portal para data/lore/ deste repo.
//
// A FONTE DA VERDADE é wai-aventuras: aqui a pasta é cópia, servida pelo lure.html
// e publicada pelo build. Nunca edite data/lore à mão — o sync recusa sobrescrever.
//
//   node scripts/sync-lore.js           sincroniza
//   node scripts/sync-lore.js --check   só mostra o que mudaria
//   node scripts/sync-lore.js --prune   também apaga o que não existe na fonte
//   node scripts/sync-lore.js --force   sobrescreve edição local (use sabendo)
//
// Roda sozinho antes do `npm run build` (script `prebuild`).

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(
  ROOT, "..", "wai-aventuras", "aventuras", "spaceships-and-aliens", "data", "lore"
);
const DST = path.join(ROOT, "data", "lore");

const argv = new Set(process.argv.slice(2));
const CHECK = argv.has("--check");
const PRUNE = argv.has("--prune");
const FORCE = argv.has("--force");

if (!fs.existsSync(SRC)) {
  console.error(
    `fonte não encontrada: ${SRC}\n` +
    "O lore vive em wai-aventuras (repo irmão, checkout ao lado deste).\n" +
    "Sem ele não há como sincronizar — e cópia local divergente é o que este script existe para evitar."
  );
  process.exit(1);
}

// caminho relativo -> conteúdo, ignorando lixo de sistema
function scan(root) {
  const out = new Map();
  const walk = (dir, rel) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const abs = path.join(dir, entry.name);
      const key = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(abs, key);
      else out.set(key, abs);
    }
  };
  walk(root, "");
  return out;
}

const src = scan(SRC);
const dst = scan(DST);

const novos = [];
const atualizados = [];
const extintos = [];

for (const [rel, srcPath] of src) {
  const dstPath = dst.get(rel);
  if (!dstPath) {
    novos.push(rel);
  } else if (!fs.readFileSync(srcPath).equals(fs.readFileSync(dstPath))) {
    atualizados.push(rel);
  }
}
for (const rel of dst.keys()) if (!src.has(rel)) extintos.push(rel);

console.log(
  `fonte: ${src.size} arquivos · cópia: ${dst.size} arquivos\n` +
  `  novos: ${novos.length} · atualizados: ${atualizados.length} · só aqui: ${extintos.length}`
);
for (const rel of atualizados.slice(0, 8)) console.log(`  ~ ${rel}`);
if (atualizados.length > 8) console.log(`  ~ ... e mais ${atualizados.length - 8}`);
for (const rel of extintos.slice(0, 8)) console.log(`  + ${rel} (não existe na fonte)`);
if (extintos.length > 8) console.log(`  + ... e mais ${extintos.length - 8}`);

if (CHECK) {
  console.log("\n--check: nada foi escrito.");
  process.exit(0);
}

// guarda: arquivo que existe nos dois lados e diverge pode ser edição feita aqui
if (atualizados.length && !FORCE) {
  console.error(
    "\nRecusado: " + atualizados.length + " arquivo(s) divergem da fonte e seriam sobrescritos.\n" +
    "Se a edição é legítima, ela pertence a wai-aventuras; mova para lá e rode de novo.\n" +
    "Para descartar o local e seguir a fonte, use --force."
  );
  process.exit(1);
}

let escritos = 0;
for (const rel of [...novos, ...atualizados]) {
  const target = path.join(DST, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(src.get(rel), target);
  escritos++;
}

let apagados = 0;
if (PRUNE) {
  for (const rel of extintos) {
    fs.rmSync(path.join(DST, rel));
    apagados++;
  }
}

console.log(
  `\nsincronizado: ${escritos} arquivo(s) escrito(s)` +
  (PRUNE ? `, ${apagados} apagado(s)` : `, ${extintos.length} mantido(s) só aqui (use --prune)`)
);
