#!/usr/bin/env node
// Popula a Biblioteca do Universo (wai-aventuras · data/lore/) a partir do corpus "Mestre dos Planetas".
// Etapas: species | worlds | factions | tech  (use --stage <etapa> ou --all)
// Uso:
//   node scripts/populate-lore.js --stage species    # gera só as espécies
//   node scripts/populate-lore.js --all              # gera tudo
//   node scripts/populate-lore.js --plan             # lista o catálogo sem chamar IA
// Lê GEMINI_KEY do .env. Modelo: gemini-3.6-flash (fallback: gemini-3.1-flash-lite-preview).
// Reutiliza window.LorePrompts de prompts/lore.js.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
// O lore vive em wai-aventuras (fonte da verdade). Aqui em data/lore é cópia:
// depois de gerar, rode `node scripts/sync-lore.js --force` para o site receber.
const LORE_DIR = process.env.LORE_DIR || path.join(
  ROOT, "..", "wai-aventuras", "aventuras", "spaceships-and-aliens", "data", "lore"
);
const INDEX_PATH = path.join(LORE_DIR, "index.json");
const CORPUS = "/Users/vanheber/Library/CloudStorage/GoogleDrive-vanheber@gmail.com/My Drive/MestreDosPlanetas/mestredosplanetas-rag/Mestre dos Planetas";

const MODELS = ["gemini-3.6-flash", "gemini-3.1-flash-lite-preview"];
const TIMEOUT = 30000;

function getEnv() {
  const out = {};
  try {
    const raw = fs.readFileSync(path.join(ROOT, ".env"), "utf8");
    raw.split("\n").forEach((line) => {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]] = m[2];
    });
  } catch (e) {}
  return out;
}

// Carrega window.LorePrompts de prompts/lore.js (padrão do projeto)
global.window = {};
require(path.join(ROOT, "prompts", "lore.js"));
const LorePrompts = global.window.LorePrompts;

// ── Catálogo ──────────────────────────────────────────────
// type válido: system | planet | geography | species | culture | tech
// source: caminho(s) de arquivo(s) .md no corpus (absolutos ou relativos a CORPUS)

const nf = (s) => String(s || "").normalize("NFC");
const fold = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function findIn(dir, fragment) {
  let entries;
  try { entries = fs.readdirSync(dir); } catch (e) { return null; }
  const f = fold(fragment);
  const match = entries.find((e) => fold(e).startsWith(f));
  return match || null;
}

function sp(chapter, name) {
  const dir = path.join(CORPUS, chapter);
  const dirName = findIn(dir, name); // pode ser diretório (Espécie - X.md/) com .md aninhado
  if (dirName) {
    const sub = path.join(dir, dirName);
    if (fs.statSync(sub).isDirectory()) {
      const inner = findIn(sub, name + ".md") || findIn(sub, ".md");
      return inner ? path.join(sub, inner) : sub;
    }
    return sub;
  }
  return path.join(dir, name + ".md");
}
function ch(chapter, name) {
  const dir = path.join(CORPUS, chapter);
  const hit = findIn(dir, name + ".md");
  return hit ? path.join(dir, hit) : path.join(dir, name + ".md");
}

const CATALOG = {
  species: [
    { id: "zenderianos", name: "Zenderianos (Inseptors)", parent: "sistema-zenderia", tags: ["espécie", "insetoides", "genética", "simbiontes"], source: sp("A Cura", "Espécie - Zenderianos") },
    { id: "humanos", name: "Humanos", parent: "sistema-terra", tags: ["espécie", "humanos", "federação"], source: sp("A Face do Inimigo", "Espécie - Humanos") },
    { id: "ninivithians", name: "Ninivithians", parent: "sistema-ninive", tags: ["espécie", "construtores", "arquitetura", "mecânica"], source: sp("A Face do Inimigo", "Espécie - Ninivithians") },
    { id: "sonhos", name: "Sonhos", tags: ["espécie", "táquions", "interdimensional", "viajantes"], source: sp("A Face do Inimigo", "Espécie - Sonhos") },
    { id: "semeador", name: "Semeador (Uno/Duo)", tags: ["espécie", "portais", "viajante", "singular"], source: sp("A revolta dos robôs", "Espécie - Semeador") },
    { id: "alados", name: "Alados", tags: ["espécie", "voadores", "planeta gasoso", "asas"], source: sp("Adeus galáxia!", "Espécie - Alados") },
    { id: "colossos", name: "Colossos", tags: ["espécie", "silício", "homens-pedra", "minas"], source: sp("Adeus galáxia!", "Espécie - Colossos") },
    { id: "titanicos", name: "Titânicos", tags: ["espécie", "gigantes", "gravidade", "tradições"], source: sp("Adeus galáxia!", "Espécie - Titânicos") },
    { id: "draks", name: "Draks", tags: ["espécie", "guerreiros", "anfíbios", "soldados"], source: sp("Arsenal 6", "Espécie - Draks") },
    { id: "iluminus", name: "Iluminus", tags: ["espécie", "energia", "protofotônica", "diplomatas"], source: sp("O último da espécie", "Espécie - Iluminus") },
    { id: "leviathans", name: "Leviathans", parent: "sistema-oceania", tags: ["espécie", "oceânia", "telepatia", "aquáticos"], source: sp("Um olho para o universo", "Espécie - Leviathans") },
    { id: "reptilus", name: "Reptilus", parent: "sistema-planaltilus", tags: ["espécie", "répteis", "domínio", "clãs"], source: sp("Um olho para o universo", "Espécie - Reptilus") },
    { id: "invisiveis", name: "Invisíveis", parent: "sistema-fantom", tags: ["espécie", "magnétons", "observadores", "fantom"], source: sp("Uma nova caminhada", "Espécie - Invisíveis") }
  ],
  worlds: [
    { id: "sistema-terra", name: "Sistema Terra", type: "system", tags: ["sistema", "federação", "terra", "netuno"], source: [ch("A Face do Inimigo", "Encontro com a Nave-Mãe"), ch("A herança perdida", "Um mergulho na Terra")] },
    { id: "sistema-zenderia", name: "Sistema Zenderia", type: "system", tags: ["sistema", "zenderia", "zenderianos"], source: [sp("A Cura", "Espécie - Zenderianos"), ch("Adeus galáxia!", "Erga-se Zender")] },
    { id: "sistema-ninive", name: "Sistema Nínive", type: "system", tags: ["sistema", "nínive", "ninivithians", "cidade"], source: ch("A Face do Inimigo", "Nínive") },
    { id: "sistema-oceania", name: "Sistema Oceânia", type: "system", tags: ["sistema", "oceânia", "leviathans", "oceano"], source: [sp("Um olho para o universo", "Espécie - Leviathans"), ch("Um olho para o universo", "A prisão oceânica")] },
    { id: "sistema-fantom", name: "Sistema Fantom", type: "system", tags: ["sistema", "fantom", "invisíveis", "gasoso"], source: sp("Uma nova caminhada", "Espécie - Invisíveis") },
    { id: "sistema-planaltilus", name: "Sistema Planaltilus", type: "system", tags: ["sistema", "planaltilus", "reptilus", "domínio"], source: [sp("Um olho para o universo", "Espécie - Reptilus"), ch("A herança perdida", "Planaltilus")] }
  ],
  factions: [
    { id: "federacao-terra", name: "Federação Terra", parent: "humanos", type: "culture", tags: ["federação", "cultura", "terra", "espécie humana"], source: [sp("A Face do Inimigo", "Espécie - Humanos"), ch("A Face do Inimigo", "Encontro com a Nave-Mãe")] },
    { id: "dominio-reptilus", name: "O Domínio", parent: "reptilus", type: "culture", tags: ["domínio", "reptilus", "clãs", "cultura"], source: sp("Um olho para o universo", "Espécie - Reptilus") }
  ],
  tech: [
    { id: "atlantis", name: "Atlantis", parent: "federacao-terra", type: "tech", tags: ["nave", "nave-mãe", "federação", "delta"], source: [ch("A Face do Inimigo", "Encontro com a Nave-Mãe"), ch("A Cura", "O Cruzador Canhão")] },
    { id: "cruzador-canhao", name: "Cruzador Canhão", parent: "zenderianos", type: "tech", tags: ["nave", "zenderianos", "canhão", "guerra"], source: ch("A Cura", "O Cruzador Canhão") },
    { id: "spacenet", name: "Spacenet", parent: "ninivithians", type: "tech", tags: ["rede", "comunicação", "interplanetária", "laser invisível"], source: ch("A Face do Inimigo", "Nínive") },
    { id: "holodisco", name: "Holodisco", parent: "ninivithians", type: "tech", tags: ["mídia", "holográfico", "armazenamento"], source: ch("A Face do Inimigo", "Nínive") },
    { id: "ciclopes", name: "Ciclopes", parent: "ninivithians", type: "tech", tags: ["robôs", "polícia", "nínive", "vigilância"], source: ch("A Face do Inimigo", "Nínive") }
  ]
};

const STAGES = Object.keys(CATALOG);

// ── Helpers ───────────────────────────────────────────────
function loadSource(entry) {
  const list = Array.isArray(entry.source) ? entry.source : [entry.source];
  let parts = [];
  for (const p of list) {
    try {
      let text = fs.readFileSync(p, "utf8");
      text = text.replace(/!\[[^\]]*\]\[[^\]]*\]/g, "");           // imagem ![][ref]
      text = text.replace(/^\[[^\]]+\]:\s*\S+\s*(width=.*)?$/gm, ""); // ref imagem
      text = text.replace(/\n{3,}/g, "\n\n").trim();
      if (text) parts.push(text);
    } catch (e) {
      console.warn("  ! fonte não encontrada:", p);
    }
  }
  return parts.join("\n\n").trim();
}

function callGemini(systemPrompt, userPrompt) {
  const key = getEnv().GEMINI_KEY;
  if (!key) return Promise.reject(new Error("GEMINI_KEY não encontrada no .env"));
  let attempt = 0;
  const tryModel = () => {
    const model = MODELS[attempt % MODELS.length];
    attempt++;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.7 }
      }),
      signal: AbortSignal.timeout(TIMEOUT)
    }).then(async (res) => {
      if (!res.ok) {
        const code = res.status;
        const body = await res.text().catch(() => "");
        if ((code === 429 || code === 503) && attempt < MODELS.length * 3) {
          await new Promise((r) => setTimeout(r, 2000 * attempt));
          return tryModel();
        }
        throw new Error(`HTTP ${code}: ${body.slice(0, 200)}`);
      }
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Sem texto na resposta");
      return text;
    });
  };
  return tryModel();
}

function parseEntry(text) {
  // o modelo deve devolver { index: {...}, md: "..." } — tolera fences
  const clean = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  const parsed = JSON.parse(clean);
  return { index: parsed.index, md: parsed.md };
}

function writeEntry(entry, index, md) {
  const file = path.join(LORE_DIR, index.file);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, md.trimEnd() + "\n");
}

function readIndex() {
  try {
    return JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));
  } catch (e) {
    return [];
  }
}

function rebuildIndex(newEntries) {
  const existing = readIndex().filter((e) => {
    const f = path.join(LORE_DIR, e.file);
    return typeof e.file === "string" && fs.existsSync(f);
  });
  const existingIds = new Set(existing.map((e) => e.id));
  const merged = [...existing];
  for (const e of newEntries) {
    if (!existingIds.has(e.id)) merged.push(e);
  }
  // ordena: pais antes de filhos, depois por nome
  merged.sort((a, b) => {
    const ap = a.parent ? 1 : 0;
    const bp = b.parent ? 1 : 0;
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

if (planOnly) {
  for (const s of STAGES) {
    console.log(`\n=== ${s} (${CATALOG[s].length}) ===`);
    for (const e of CATALOG[s]) {
      console.log(`  [${e.type || "species"}] ${e.name}  (parent: ${e.parent || "—"})`);
    }
  }
  process.exit(0);
}

const stages = stageArg && stageArg !== "all" ? [stageArg] : STAGES;
if (stageArg && !STAGES.includes(stageArg)) {
  console.error("Etapa inválida. Use: " + STAGES.join(" | ") + " | all");
  process.exit(1);
}

(async () => {
  const keepIds = new Set(readIndex().map((e) => e.id));
  const allEntries = [];
  let ok = 0, fail = 0;

  for (const stage of stages) {
    console.log(`\n===== ETAPA: ${stage} (${CATALOG[stage].length}) =====`);
    for (const entry of CATALOG[stage]) {
      process.stdout.write(`  → ${entry.name} ... `);
      const type = entry.type || "species";
      const targetFile = path.join(LORE_DIR, type, entry.id + ".md");
      const existingEntry = readIndex().find((e) => e.id === entry.id);
      if (fs.existsSync(targetFile) && existingEntry) {
        keepIds.add(entry.id);
        allEntries.push(existingEntry);
        console.log("já existe — pulado");
        ok++;
        continue;
      }
      const source = loadSource(entry);
      if (!source) { console.log("SEM FONTE — pulado"); fail++; continue; }
      try {
        const raw = await callGemini(
          LorePrompts.system(""),
          LorePrompts.user(source, type, entry.name, entry.parent || "")
        );
        const { index, md } = parseEntry(raw);
        // garante id/type/parent corretos vindos do catálogo (o modelo pode errar)
        index.id = entry.id;
        index.file = `${type}/${entry.id}.md`;
        index.type = type;
        if (entry.parent) index.parent = entry.parent;
        else delete index.parent;
        if (entry.tags) index.tags = entry.tags;
        writeEntry(entry, index, md);
        keepIds.add(entry.id);
        allEntries.push(index);
        ok++;
        console.log("ok");
      } catch (e) {
        fail++;
        console.log("FALHOU — " + e.message);
      }
      await new Promise((r) => setTimeout(r, 600)); // suaviza rate limit
    }
  }

  // só reescreve o index se houver mudanças nesta execução
  const before = readIndex().length;
  const after = rebuildIndex(allEntries);
  console.log(`\nPronto: ${ok} ok, ${fail} falhas. index.json: ${before} → ${after} entradas.`);
})().catch((e) => {
  console.error("Erro fatal:", e.message);
  process.exit(1);
});