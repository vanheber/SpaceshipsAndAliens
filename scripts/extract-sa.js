#!/usr/bin/env node
// Extrai conteúdo de lore do sourcebook "Spaceships & Aliens" (data/lore/spaceships-and-aliens.md)
// em entradas da Biblioteca do Universo — extração DIRETA (sem IA), o texto já é enciclopédico.
// Ignora regras de jogo (tarifas, stats de personagem, "como jogar"). Mantém prosa de lore.
//
// Uso:
//   node scripts/extract-sa.js --stage systems    # sistemas
//   node scripts/extract-sa.js --stage planets    # planetas
//   node scripts/extract-sa.js --stage ships      # naves
//   node scripts/extract-sa.js --stage orgs       # organizações
//   node scripts/extract-sa.js --stage history    # história
//   node scripts/extract-sa.js --stage ai         # inteligências artificiais
//   node scripts/extract-sa.js --all
//   node scripts/extract-sa.js --plan             # lista o catálogo sem extrair

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const LORE_DIR = path.join(ROOT, "data", "lore");
const INDEX_PATH = path.join(LORE_DIR, "index.json");
const SRC = path.join(LORE_DIR, "spaceships-and-aliens.md");

const fold = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// ── Catálogo ──────────────────────────────────────────────
// heading: texto do título na fonte (matching por fold)
const SYSTEMS = [
  { heading: "Sistema Nínive", id: "sistema-ninive" },
  { heading: "Sistema Nova Sírius", id: "sistema-nova-sirius" },
  { heading: "Sistema Zeta3", id: "sistema-zeta3" },
  { heading: "Sistema Nécton", id: "sistema-necton" },
  { heading: "Sistema Vulcan (Inferno)", id: "sistema-vulcan" },
  { heading: "Sistema Reptilus", id: "sistema-reptilus" },
  { heading: "Sistema Roshini", id: "sistema-roshini" },
  { heading: "Sistema Stratus", id: "sistema-stratus" },
  { heading: "Sistema Zender", id: "sistema-zender" },
  { heading: "Sistema Taurus", id: "sistema-taurus" }
];

const PLANETS = [
  { heading: "Zigurate", parent: "sistema-ninive" }, { heading: "Kalmar", parent: "sistema-ninive" },
  { heading: "Adissônia", parent: "sistema-ninive" }, { heading: "Nínive", parent: "sistema-ninive" },
  { heading: "Mongoro", parent: "sistema-ninive" },
  { heading: "Dosher", parent: "sistema-nova-sirius" }, { heading: "Vine", parent: "sistema-nova-sirius" },
  { heading: "Terra 2", parent: "sistema-nova-sirius" }, { heading: "Emérida", parent: "sistema-nova-sirius" },
  { heading: "Garmot", parent: "sistema-nova-sirius" },
  { heading: "Berço", parent: "sistema-zeta3" }, { heading: "Phantom", parent: "sistema-zeta3" },
  { heading: "Ilúmina", parent: "sistema-zeta3" }, { heading: "Mortália", parent: "sistema-zeta3" },
  { heading: "Harmonia", parent: "sistema-necton" }, { heading: "Gemini 1 e 2", parent: "sistema-necton" },
  { heading: "Oceânia", parent: "sistema-necton" },
  { heading: "Golem", parent: "sistema-vulcan" }, { heading: "Sulfur", parent: "sistema-vulcan" },
  { heading: "Petros", parent: "sistema-vulcan" }, { heading: "Acid", parent: "sistema-vulcan" },
  { heading: "Raptor", parent: "sistema-reptilus" }, { heading: "Fauna", parent: "sistema-reptilus" },
  { heading: "Flora", parent: "sistema-reptilus" }, { heading: "Aligator", parent: "sistema-reptilus" },
  { heading: "Reptilus", parent: "sistema-reptilus", id: "reptilus-mundo" }, { heading: "Âmbar", parent: "sistema-reptilus" },
  { heading: "Tahlim", parent: "sistema-roshini" }, { heading: "Bonrore", parent: "sistema-roshini" },
  { heading: "Zagar e Zaseru", parent: "sistema-roshini" }, { heading: "Ontelia", parent: "sistema-roshini" },
  { heading: "Cirrus", parent: "sistema-stratus" }, { heading: "Cumulus", parent: "sistema-stratus" },
  { heading: "Nimbus", parent: "sistema-stratus" }, { heading: "Ciclone", parent: "sistema-stratus" },
  { heading: "Celestia", parent: "sistema-stratus" }, { heading: "Sonho", parent: "sistema-stratus" },
  { heading: "Tortura", parent: "sistema-zender" }, { heading: "Agonia", parent: "sistema-zender" },
  { heading: "Zenderia", parent: "sistema-zender" },
  { heading: "Tridente", parent: "sistema-taurus" }, { heading: "Titânia", parent: "sistema-taurus" }
];

const SHIPS = [
  { heading: "Classe Cometa" }, { heading: "Classe Estrela" }, { heading: "Classe Constelação" },
  { heading: "Classe Galáxia" }, { heading: "Estação espacial" },
  { heading: "SavePod" }, { heading: "Águia Sorrateira" }, { heading: "14X" }, { heading: "Horizon" },
  { heading: "Apolion" }, { heading: "Arganon" }, { heading: "Tiranus" }
];

const ORGS = [
  { heading: "Federação" }, { heading: "Imperium" }, { heading: "DNAgon" }, { heading: "Konpasu" },
  { heading: "Shini" }, { heading: "Kimera" }, { heading: "União Drak" }, { heading: "Iluminados" },
  { heading: "Domínio Reptilus" }, { heading: "Independentes" }, { heading: "Piratas" }, { heading: "Mercenários" }
];

const HISTORY = [
  { heading: "O Calendário Universal" }, { heading: "Eras" },
  { heading: "O Primeiro contato dos Tahlianos" }, { heading: "A Primeira Federação" }
];

const AI = [
  { heading: "A.L.M.A" }, { heading: "SkypiA" }, { heading: "Aistein" },
  { heading: "SoberbiA" }, { heading: "Ailon" }, { heading: "IS42" }
];

const STAGES = {
  systems: { type: "system", list: SYSTEMS.map((e) => ({ ...e, type: "system" })) },
  planets: { type: "planet", list: PLANETS.map((e) => ({ ...e, type: "planet" })) },
  ships: { type: "ship", list: SHIPS.map((e) => ({ ...e, type: "ship" })) },
  orgs: { type: "organization", list: ORGS.map((e) => ({ ...e, type: "organization" })) },
  history: { type: "history", list: HISTORY.map((e) => ({ ...e, type: "history" })) },
  ai: { type: "ai", list: AI.map((e) => ({ ...e, type: "ai" })) }
};

// ── Parsing do arquivo fonte ──────────────────────────────
function slugify(s) {
  return String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function parseSections() {
  const lines = fs.readFileSync(SRC, "utf8").split("\n");
  const sections = []; // { level, title, titleFold, start }
  lines.forEach((line, i) => {
    const m = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (m) {
      const title = m[2].replace(/\*\*/g, "").trim();
      if (title && title.length > 2) sections.push({ level: m[1].length, title, fold: fold(title), start: i + 1 });
    }
  });
  // seção termina no próximo heading de nível igual ou mais raso (captura subseções internas)
  sections.forEach((s, i) => {
    let end = lines.length;
    for (let j = i + 1; j < sections.length; j++) {
      if (sections[j].level <= s.level) { end = sections[j].start - 1; break; }
    }
    s.end = end;
  });
  return { lines, sections };
}

function findSection(sections, heading) {
  const f = fold(heading);
  const cand = sections.filter((s) => s.fold === f);
  return cand[0] || null;
}

// Para planetas: precisa pegar a seção exata (#### do planeta), não a do sistema.
// Usa o heading exato; se houver múltiplos (ex "Nínive" cidade vs planeta), pega o de nível 4.
function findSectionLevel(sections, heading, preferredLevel) {
  const f = fold(heading);
  const cand = sections.filter((s) => s.fold === f);
  if (!cand.length) return null;
  if (preferredLevel) {
    const exact = cand.find((s) => s.level === preferredLevel);
    if (exact) return exact;
  }
  return cand[0];
}

const GAME_NOISE = [
  /copyright\s*©\s*\d{4}\s*imaginaris.*/i,
  /^[\s\d\-_.=~|/\\]+$/,
  /<!--\s*(start|end) of picture text.*/i,
  /^\s*\d{1,4}\s*$/,
  /^\s*\[.*\]:\s*\S+/,
  /SpacesHiPsQAtteNns/i,
  /^Copyright\s*$/i,
  /^Copyright\s*©/i,
  /\d+\s*(XSATS|Xsats|sats)\b/i, // custos (mecânica de jogo)
  /^\s*\|/ // tabelas de stats OCR
];

const GAME_STAT = [
  /^habitantes?\s*:/i, /^rota[çc][aã]o\s*:/i, /^transla[çc][aã]o\s*:/i, /^dist[âa]ncia da estrela\s*:/i,
  /^gravidade\s*:/i, /^classe\s+[a-zA-Z]\s*$/i, /^tarifa\s*:/i, /^retorno\s*$/i, /^retorno\s*:/i,
  /^adicionais avulsos\s*:/i, /^luas?\s*:/i, /^habitantes\s*$/i
];

function cleanSectionText(rawLines, start, end) {
  let out = [];
  for (let i = start - 1; i < end; i++) {
    let line = rawLines[i].replace(/\*\*/g, ""); // tira ** antes dos filtros
    if (/^#{1,6}\s/.test(line)) continue; // títulos repetidos dentro do corpo
    if (/^\[.*\]$/.test(line.trim())) continue; // refs de nota/imagem
    if (GAME_NOISE.some((re) => re.test(line))) continue;
    if (GAME_STAT.some((re) => re.test(line.trim()))) continue;
    if (/^\s*[-–]\s*\S+.*\d+\s*sats/i.test(line)) continue;
    if (/^\s*\d{1,4}\s+sat/i.test(line)) continue;
    out.push(line.trimEnd());
  }
  let txt = [];
  let blank = false;
  for (const l of out) {
    if (l.trim() === "") { if (!blank) txt.push(""); blank = true; }
    else { txt.push(l); blank = false; }
  }
  return txt.map((l) => l.trimEnd()).join("\n").trim();
}

function buildMd(title, body) {
  return `# ${title}\n\n${body}\n`;
}

// ── Index ─────────────────────────────────────────────────
function readIndex() {
  try { return JSON.parse(fs.readFileSync(INDEX_PATH, "utf8")); } catch (e) { return []; }
}
function rebuildIndex(newEntries) {
  const existing = readIndex().filter((e) => {
    const f = path.join(LORE_DIR, e.file);
    return typeof e.file === "string" && fs.existsSync(f);
  });
  const ids = new Set(existing.map((e) => e.id));
  const merged = [...existing];
  for (const e of newEntries) if (!ids.has(e.id)) merged.push(e);
  merged.sort((a, b) => {
    const ap = a.parent ? 1 : 0, bp = b.parent ? 1 : 0;
    if (ap !== bp) return ap - bp;
    return (a.name || "").localeCompare(b.name || "", "pt-BR");
  });
  fs.writeFileSync(INDEX_PATH, JSON.stringify(merged, null, 2) + "\n");
  return merged.length;
}

// ── Main ──────────────────────────────────────────────────
const args = process.argv.slice(2);
const stageArg = args.includes("--all") ? "all" : (args.find((a) => a.startsWith("--stage=")) || "").split("=")[1];
const planOnly = args.includes("--plan");
const force = args.includes("--force");

if (planOnly) {
  for (const [s, st] of Object.entries(STAGES)) {
    console.log(`\n=== ${s} (${st.list.length}) — tipo ${st.type} ===`);
    for (const e of st.list) console.log(`  [${st.type}] ${e.heading}  (parent: ${e.parent || "—"})`);
  }
  process.exit(0);
}

const stages = stageArg && stageArg !== "all" ? [stageArg] : Object.keys(STAGES);
if (stageArg && !STAGES[stageArg]) {
  console.error("Etapa inválida. Use: " + Object.keys(STAGES).join(" | ") + " | all");
  process.exit(1);
}

const { lines, sections } = parseSections();
const newEntries = [];
let ok = 0, fail = 0, skip = 0;

for (const stage of stages) {
  const st = STAGES[stage];
  console.log(`\n===== ETAPA: ${stage} (${st.list.length}) =====`);
  for (const entry of st.list) {
    const name = entry.heading;
    const type = entry.type;
    const id = entry.id || slugify(name);
    const file = path.join(LORE_DIR, type, id + ".md");
    if (fs.existsSync(file) && !force) { skip++; console.log(`  → ${name} — já existe, pulado`); continue; }
    const sec = findSectionLevel(sections, name, 4);
    if (!sec) { fail++; console.log(`  → ${name} — SEÇÃO NÃO ENCONTRADA`); continue; }
    const body = cleanSectionText(lines, sec.start, sec.end);
    if (!body) { fail++; console.log(`  → ${name} — VAZIA`); continue; }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, buildMd(name, body));
    const index = { id, file: `${type}/${id}.md`, name, type };
    if (entry.parent) index.parent = entry.parent;
    if (type === "planet") index.tags = ["planeta"];
    if (type === "ship") index.tags = ["nave"];
    if (type === "organization") index.tags = ["organização"];
    if (type === "history") index.tags = ["história"];
    if (type === "ai") index.tags = ["inteligência artificial"];
    if (type === "system") index.tags = ["sistema"];
    newEntries.push(index);
    ok++;
    console.log(`  → ${name} ok`);
  }
}

const before = readIndex().length;
const after = rebuildIndex(newEntries);
console.log(`\nPronto: ${ok} geradas, ${skip} puladas, ${fail} falhas. index.json: ${before} → ${after}.`);
if (fail) console.log("Atenção: algumas seções não foram encontradas — verifique os headings na fonte.");