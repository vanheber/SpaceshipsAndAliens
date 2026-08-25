# Sistema de Compartilhamento

O Spaceships and Aliens compartilha mini-mapas das descobertas do Gerador de Missão com jogadores em tempo real via três canais: BroadcastChannel, localStorage, e SnaP2P.

## Canais de Distribuição

### BroadcastChannel (mesmo navegador)
```js
var ch = new BroadcastChannel("sna-unit");
ch.postMessage({ type: "shared-map", data: { seed, roomCount, paletteKey, planetName, encounterType, timestamp } });
```

- Canal `"sna-unit"` compartilhado com o sistema de sessão (`saveToSession`)
- Mensagens de tipo `"shared-map"` são ignoradas pelo handler de sessão e vice-versa
- Escutado em `shared-map.html` e em páginas P2P

### localStorage (persistência)
```js
localStorage.setItem("sna-shared-map", JSON.stringify(data));
```

- Sobrescreve o mapa anterior (só um mapa compartilhado por vez)
- Detectado via `window.addEventListener("storage", ...)` em outras abas

### SnaP2P (jogadores remotos)
```js
SnaP2P.send(null, { type: "shared-map", data: data });
```

- Mensagem broadcast (destinatário `null`) → todos os jogadores recebem
- Handler em `shared-map.html` salva em localStorage e renderiza

## Trigger: Botão "Compartilhar Mapa"

Em `oneshot.html`, função `shareCurrentMap()`:

```js
function shareCurrentMap() {
    var disc = discoveries[discoveryIndex - 1];
    var seed = (disc.index + 1) * 31 + _hashCode(planet.name);
    var roomCount = 3 + Math.abs(seed) % 6;
    var paletteKey = resolvePaletteKey(planet, disc);
    var data = { seed, roomCount, paletteKey, planetName, encounterType, timestamp };
    localStorage.setItem("sna-shared-map", JSON.stringify(data));
    ch.postMessage({ type: "shared-map", data: data });
    SnaP2P.send(null, { type: "shared-map", data: data });
}
```

O mapa é **determinístico**: seed derivada de `disc.index + 1 * 31 + hashCode(planet.name)`, então o jogador reconstrói o mesmo layout sem receber o grid inteiro.

## Página do Jogador (`shared-map.html`)

- Carrega `store.js`, `p2p.js`, `p2p-hub.js`, `procgen-map.js`
- Lê `localStorage("sna-shared-map")` no load
- Escuta 3 canais em tempo real: BroadcastChannel, storage event, SnaP2P
- Renderiza via `buildSharedMap(containerId, seed, roomCount, paletteKey)`
- Responsivo: Desktop 1000×1000, tablet 600×600, mobile 320×320
- Menu lateral com link "Mini-Mapa" em todas as páginas

## API Pública

| Função | Arquivo | Uso |
|---|---|---|
| `buildSharedMap(id, seed, roomCount, paletteKey)` | `procgen-map.js` | Renderiza mapa 3D em container |
| `resolvePaletteKey(planet, disc)` | `procgen-map.js` | Determina paleta por planeta + descoberta |
| `disposeDiscoveryMap(id)` | `procgen-map.js` | Limpa cena, geometria, renderer |
| `_hashCode(str)` | `procgen-map.js` | Hash FNV-like para seeds determinísticas |
| `shareCurrentMap()` | `oneshot.html` | Dispara compartilhamento nos 3 canais |

## Exemplo de Fluxo

```
GM gera descoberta → clica "Compartilhar Mapa"
  ├─ localStorage("sna-shared-map") ← persistência
  ├─ BroadcastChannel("sna-unit")   ← outras abas do GM
  └─ SnaP2P.send(null, ...)         ← jogadores remotos
       └─ shared-map.html detecta → renderiza buildSharedMap()
```

## Regras

1. `paletteKey` deve ser uma chave válida de `P` em `procgen-map.js`, senão fallback pra `P.default`
2. `seed` negativo é tratado com `Math.abs(seed) % 6` para `roomCount`
3. `elev` (Int8Array) e grid são recalculados no destino — só seed trafega
4. Timestamp evita que mapas antigos sobrescrevam novos no mesmo cliente
