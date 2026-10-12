// Card 9:16 (§18) — markup puro, sem estado. ctx = {skin, refByName} de js/skin.js.

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const signed = (n) => (n >= 0 ? `+${n}` : `${n}`);
const KIND = { entity: 'Personagem', item: 'Item', power: 'Poder', adventure: 'Aventura' };

const brand = (cls, src, alt) =>
  `<div class="${cls}"><img src="${src}" alt="${alt}" onerror='this.replaceWith(document.createTextNode(this.alt))'></div>`;

// §18.2: 4 slots (tl tr bl br); slot nulo não é renderizado.
function corners(kind, c, ctx) {
  const t = (key) => ctx.skin.traits[key].name;
  const h = ctx.skin.headlineTraits;
  // funções: só o ramo do kind é avaliado (sem lazy o card de outro tipo estoura)
  const slots = {
    entity: () => [
      { l: t(h[0]), v: signed(c.traits[h[0]]) }, { l: t(h[1]), v: signed(c.traits[h[1]]) },
      { l: 'PV', v: `${c.pool.start}/${c.pool.max}` }, { l: 'Armadura', v: c.defense },
    ],
    item: () => [
      { l: 'Dado', v: c.dice ?? '—' },
      { l: 'Bônus', v: c.traits?.[0] ?? '—' },
      { l: 'Tags', v: (c.tags ?? []).join(' · ') }, null,
    ],
    power: () => [
      { l: 'Valor', v: signed(c.value) }, { l: 'Custo', v: c.cost },
      { l: 'Traço', v: c.trait ? t(c.trait) : '—' }, null,
    ],
    adventure: () => [{ l: 'Ameaça', v: c.threat ?? '—' }, { l: 'Data', v: c.date ?? '—' }, null, null],
  }[kind]();
  return ['tl', 'tr', 'bl', 'br']
    .map((pos, i) => (slots[i] ? `<span class="corner c-${pos}"><span>${esc(slots[i].l)}</span><b>${esc(slots[i].v)}</b></span>` : ''))
    .join('');
}

function typeName(kind, c) {
  if (kind === 'entity') return c.type;
  if (kind === 'item') return c.damage != null ? `Item · Dano ${c.damage}` : 'Item';
  if (kind === 'power') return `Poder ${signed(c.value)}`;
  return c.kind === 'missao' ? 'Missão' : 'Gancho';
}

function prose(kind, c, ctx) {
  if (kind === 'adventure')
    return esc(c.summary) + (c.record ? ` <a class="wai-ext" href="diariodebordo.html">Registro completo</a>` : '');
  const text = c.desc || '';
  // [[palavra-chave]] → botão que resolve no mapa de refs; texto cru se não resolver
  return esc(text).replace(/\[\[([^\]]+)\]\]/g, (m, name) => {
    const ref = ctx.refByName.get(name.toLowerCase());
    return ref ? `<button class="wai-ref" data-ref="${ref}">${name}</button>` : name;
  });
}

export function cardHTML(kind, c, ctx) {
  const chips = kind === 'entity'
    ? `<div class="card-links">${(c.items || []).map((i) => `<button class="wai-ref" data-ref="item:${i.id}">${esc(i.name)}</button>`).join('')}</div>`
    : '';
  const art = c.image ? ` style="background-image:url('${esc(c.image)}')"` : '';
  return `<article class="wai-card" data-kind="${kind}" data-id="${esc(c.id)}" aria-label="${esc(c.name || c.title)}">
    ${brand('card-sign-top', 'img/brand/spaceships-and-aliens.svg', 'Spaceships and Aliens')}
    <div class="card-art"${art}>${corners(kind, c, ctx)}</div>
    <div class="card-box">
      <h3 class="card-name">${esc(c.name || c.title)}</h3>
      <p class="card-type">${esc(typeName(kind, c))}</p>
      <p class="card-text">${prose(kind, c, ctx)}${chips}</p>
    </div>
    ${brand('card-sign-bot', 'img/brand/wai.svg', 'WAI Game System')}
  </article>`;
}
