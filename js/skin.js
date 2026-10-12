// Carrega skin.json + catálogos e resolve refs `tipo:id` (§18.3).
const json = async (p) => (await fetch(p)).json();
const idOf = (ref) => ref.replace(/^[a-z]+:/, '');

export async function loadSkin() {
  const skin = await json('skin.json');
  const [items, powers, entities, adventures] = await Promise.all(
    ['items', 'powers', 'roster', 'adventures'].map((k) => json(skin.paths[k]))
  );
  const byId = (arr) => new Map(arr.map((o) => [o.id, o]));
  const itemById = byId(items), powerById = byId(powers), advById = byId(adventures);

  // refs ainda não expandidos pelo motor: power + itens do personagem
  for (const e of entities) {
    e.ability = powerById.get(idOf(e.powerRef)) || null;
    e.items = (e.itemRefs || []).map((r) => itemById.get(idOf(r))).filter(Boolean);
  }

  const kindOf = { item: 'item', power: 'power', adv: 'adventure' };
  const refByName = new Map([
    ...items.map((i) => [i.name.toLowerCase(), `item:${i.id}`]),
    ...powers.map((p) => [p.name.toLowerCase(), `power:${p.id}`]),
    ...adventures.map((a) => [a.title.toLowerCase(), `adv:${a.id}`]),
  ]);
  const resolve = (ref) => {
    const [tipo, id] = [ref.slice(0, ref.indexOf(':')), idOf(ref)];
    return tipo === 'item' ? itemById.get(id) : tipo === 'power' ? powerById.get(id) : tipo === 'adv' ? advById.get(id) : null;
  };
  const kindFor = (ref) => kindOf[ref.slice(0, ref.indexOf(':'))];

  return { skin, items, powers, entities, adventures, refByName, resolve, kindFor };
}
