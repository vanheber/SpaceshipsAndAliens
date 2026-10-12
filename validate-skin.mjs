// Valida a skin: refs resolvem, imagens existem, contrato do §18 (wai-core) bate.
// node validate-skin.js   → saída 1 se houver problema.
import { readFileSync, existsSync } from 'node:fs';
import { cardHTML } from './js/card.js';

const errs = [];
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const has = (p) => existsSync(p);
const skin = read('skin.json');
const items = read(skin.paths.items);
const powers = read(skin.paths.powers);
const entities = read(skin.paths.roster);
const adventures = read(skin.paths.adventures);
const dup = (list, key) => list.filter((o, i) => list.findIndex((x) => x[key] === o[key]) !== i);

for (const p of [skin.paths.items, skin.paths.powers, skin.paths.roster, skin.paths.adventures])
  if (!has(p)) errs.push(`path inexistente: ${p}`);

if (dup(items, 'id').length) errs.push('items: id repetido');
if (dup(powers, 'id').length) errs.push('powers: id repetido');
if (dup(entities, 'id').length) errs.push('entities: id repetido');
if (dup(adventures, 'id').length) errs.push('adventures: id repetido');

const byId = (list) => new Map(list.map((o) => [o.id, o]));
const itemById = byId(items);
const powerById = byId(powers);

for (const e of entities) {
  if (e.pool.max !== e.pool.start * 2) errs.push(`${e.id}: pool.max != 2×start (motor: MAX_FACTOR)`);
  if (!(e.defense > 0)) errs.push(`${e.id}: defense inválido`);
  for (const t of skin.headlineTraits)
    if (typeof e.traits?.[t] !== 'number') errs.push(`${e.id}: traço de manchete ausente: ${t}`);
  if (!e.desc.includes('[[')) errs.push(`${e.id}: desc sem nenhuma [[palavra-chave]]`);
  for (const m of e.desc.match(/\[\[([^\]]+)\]\]/g) || []) {
    const name = m.slice(2, -2);
    if (!powers.some((p) => p.name === name)) errs.push(`${e.id}: [[${name}]] não resolve pra nenhum poder`);
  }
  if (!powerById.has(e.powerRef.replace(/^power:/, ''))) errs.push(`${e.id}: powerRef quebrado: ${e.powerRef}`);
  for (const ref of e.itemRefs || []) {
    const id = ref.replace(/^item:/, '');
    if (!itemById.has(id)) errs.push(`${e.id}: itemRef quebrado: ${ref}`);
  }
  if (!has(e.image)) errs.push(`${e.id}: imagem não existe: ${e.image}`);
}

for (const it of items) {
  if (!has(it.image)) errs.push(`${it.id}: imagem não existe: ${it.image}`);
  if (it.dice && !/^\d*d\d+([+-]\d+)?$/i.test(it.dice)) errs.push(`${it.id}: dice fora do formato do motor: ${it.dice}`);
  if (!it.tags?.length) errs.push(`${it.id}: sem tags (canto inferior do card)`);
}

for (const p of powers)
  if (typeof p.value !== 'number' || !p.desc) errs.push(`${p.id}: value/desc ausente`);

for (const a of adventures) {
  if (!['missao', 'gancho'].includes(a.kind)) errs.push(`${a.id}: kind inválido: ${a.kind}`);
  if (!a.title || !a.summary) errs.push(`${a.id}: title/summary ausente`);
  if (a.record && !has(a.record)) errs.push(`${a.id}: record não existe: ${a.record}`);
}

// smoke: os 4 tipos viram card 9:16 e nenhuma [[keyword]] fica por resolver
const idOf = (ref) => ref.replace(/^[a-z]+:/, '');
const refByName = new Map([
  ...items.map((i) => [i.name.toLowerCase(), `item:${i.id}`]),
  ...powers.map((p) => [p.name.toLowerCase(), `power:${p.id}`]),
  ...adventures.map((a) => [a.title.toLowerCase(), `adv:${a.id}`]),
]);
for (const e of entities) {
  e.items = (e.itemRefs || []).map((r) => itemById.get(idOf(r))).filter(Boolean);
}
for (const [kind, list] of [['entity', entities], ['item', items], ['power', powers], ['adventure', adventures]])
  for (const c of list) {
    const html = cardHTML(kind, c, { skin, refByName });
    if (!html.includes('<article')) errs.push(`render ${kind} ${c.id}: sem <article>`);
    if (html.includes('[[')) errs.push(`render ${kind} ${c.id}: [[ por resolver`);
    if (html.includes('undefined')) errs.push(`render ${kind} ${c.id}: saiu "undefined"`);
  }

if (errs.length) {
  console.error('skin inválida:\n- ' + errs.join('\n- '));
  process.exit(1);
}
console.log(`skin OK: ${entities.length} entidades, ${items.length} itens, ${powers.length} poderes, ${adventures.length} aventuras`);
