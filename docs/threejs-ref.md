# Referência: threejs-procedural-dungeon

## Câmera Ortográfica Isométrica

```js
const BASE_HALF = 55;
let aspect = innerWidth / innerHeight;
const cam = new THREE.OrthographicCamera(
  -BASE_HALF * aspect, BASE_HALF * aspect,
   BASE_HALF, -BASE_HALF,
  -400, 800
);
let yaw = Math.PI / 4;   // 45°
let pitch = 0.64;        // ~36.7°
const camTarget = new THREE.Vector3(0, 0, 0);

function updateCam() {
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const f = new THREE.Vector3(cp * Math.sin(yaw), sp, cp * Math.cos(yaw));
  cam.position.copy(camTarget).addScaledVector(f, 220);
  cam.lookAt(camTarget);
}
```

- **Zoom dinâmico:** `cam.zoom = min(2.2, max(0.22, BASE_HALF / (max(W,H) * 0.62)))`
- **Orbit drag:** yaw -= dx * 0.005; pitch = clamp(0.32, 1.15, pitch + dy * 0.005)
- **Wheel:** `cam.zoom *= exp(-deltaY * 0.0012)`, clamped [0.12, 6]
- **Resize:** atualiza left/right pelo aspect ratio

## ChamferBox (Box Chanfrada)

Gera vértices manualmente sem `BoxGeometry`:

```js
function chamferBox(w, h, d, ch) {
  const hw = w/2, hd = d/2;
  const iw = max(0.01, hw - ch), id = max(0.01, hd - ch), hb = max(0.01, h - ch);
  // 2 belts: base belt (y=0 a y=hb) largura cheia, top belt (y=hb a y=h) com cantos recuados
  // 10 faces trianguladas: 4 laterais inferiores + 4 laterais superiores + topo + fundo
  // Returns BufferGeometry via bgFromTris(v)
}
```

- **10 faces:** bottom-front/back/right/left, top-front/back/right/left, top-face, bottom-face
- **Efeito visual:** quinas com 45° de bisel, aspecto de miniatura/diorama
- **Usado em:** wall (1,1,1, ch=0.07), wallCap (1.09,0.13,1.09, ch=0.035), floor, pillar, etc.

## InstancedMesh + Animação de Revelação

```js
const ws = instSet(), cs = instSet();
// instSet() acumula pos, scale, rot, cor, delay
for each wall cell:
  ws.add(wx(x), 0, wz(y), 1, h, 1, 0, cor, delay)
meshes.wall = buildMesh(ws, GEO.wall, matStone, 'rise', 0.42, 1);
```

- **buildMesh:** cria `InstancedMesh` único por geometria+material
- **Modos de animação:** `'rise'` (cresce y scale de 0→h), `'pop'` (scale 0→1), `'fade'`
- **Delay:** BFS distance from entrance → staggered reveal "construindo-se"
- **Cor por instância:** `setColorAt(i, cor)` com variação aleatória ±8-10%

## Iluminação

```js
const hemi = new THREE.HemisphereLight(0x2e3a52, 0x0a0b10, 0.55);
const dirL = new THREE.DirectionalLight(0xffe8c8, 0.85);
dirL.position.set(72, 78, 46);
dirL.castShadow = true;
dirL.shadow.mapSize.set(2048, 2048);
dirL.shadow.bias = -0.0004;
dirL.shadow.normalBias = 0.55;
```

- **Shadow dinâmico:** `shHalf = max(W,H) * 0.62 + 6;` aplicado no frustum da shadow camera
- **Hemisphere:** cool sky + warm ground, controlado por tema
- **DirLight key:** ~45° do topo, sombras diagonais consistentes
- **LIGHT_K = 4π:** compensa mudança legacy→physical BRDF no r128
- **Point lights:** até 12 dinâmicos (portal, boss, shrine, tochas), flicker com sin(time*9+phase)
- **Fog:** FogExp2, densidade ~0.002-0.003, não escala com dungeon → centro limpo, bordas nevoentas

## Temas

Cada tema (ancient, molten, frost, grim, verdant) define paleta completa:

```js
function applyThemeEnv(TH) {
  scene.fog.color.set(TH.fog);
  curBg.set(TH.bg);
  hemi.color.set(TH.hemi[0]);
  hemi.groundColor.set(TH.hemi[1]);
  hemi.intensity = TH.hemi[2] * LIGHT_K;
  dirL.color.set(TH.dir[0]);
  dirL.intensity = TH.dir[1] * LIGHT_K;
}
```

- TH.wall, TH.cap, TH.floor, TH.prop — cores hex
- TH.fog, TH.bg — cores hex para neblina e background
- TH.hemi[2], TH.dir[1] — intensidades (multiplicadas por LIGHT_K)

## Pós-processamento

```js
// Tilt-shift: blur no topo 15% e base 52% do frame → efeito diorama
// Bloom: bright-pass + separable blur em materiais glowosos (fogo, lava, runas)
// Color grade: sombras frias / realces quentes + vignette + grain
```

- **UnrealBloomPass:** intensidade ~0.3-0.5, threshold ~0.8
- **Tilt-shift custom:** blurStrength escala com distância do centro vertical
- **EffectComposer + RenderPass:** pipeline de pós-processamento

## Grid → Mundo

```js
function wx(x) { return x - W/2 + 0.5; }
function wz(y) { return y - H/2 + 0.5; }
```

- Célula do grid no centro do tile: `(x - W/2 + 0.5, 0, y - H/2 + 0.5)`
- Cada tile = 1 unidade de mundo
- `W, H` dinâmicos por dungeon

## Textura Procedural (Canvas)

```js
function genStoneTex(size, rng) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  // desenha ruído + rachaduras
  return new THREE.CanvasTexture(cv);
}
```

- Ruído Perlin/Value Noise via canvas 2D
- Aplicado como `map:` no material, repetido (wrapS/wrapT = RepeatWrapping)
- Usado em todas as superfícies de pedra

## Implementação no Spaceships and Aliens (`js/procgen-map.js`)

O `procgen-map.js` adapta as técnicas da referência para gerar mini-mapas isométricos nos cards de descoberta do Gerador de Missão (`oneshot.html`).

### Geração de Layout (`generateLayout`)
- Grid dinâmico: `min(25, 11 + roomCount * 2)`
- 3-8 salas por discover, shapes: `rect`, `oct`, `ellipse`, `irregular`
- Push-apart separation (100 iterações, gap 2 tiles)
- Corredores L-shaped + Z-jog em ambientes naturais
- Corner blocks: 1×1 pillars em cantos convexos (50% por sala, 40% por canto)

### Elevation System (`elev` Int8Array)
Cada célula do grid tem uma elevação:

| `elev` | Visual | Onde |
|---|---|---|
| **0** | Piso normal (y=0) | Padrão |
| **-1** | Piso rebaixado (y=-0.12) + água se palette for oceano/tundra | Ocean, tundra |
| **-2** | Caixa preta 1.5u (buraco) | Ruins, ship, volcanic, desert, crystalline |

**Step walls:** onde `elev < 0` encontra piso normal, uma parede de 0.14u (cor da wall) é inserida na borda — cria degrau visível entre níveis.

### Paletas por Ambiente
14 paletas mapeadas por tipo de planeta ou categoria de descoberta:
- `ship`, `space`, `rescue`, `ruins`, `phenomenon`, `danger`
- Planetas: `jungle`, `desert`, `tundra`, `ocean`, `volcanic`, `crystalline`, `gasgiant`, `default`

### ChamferBox
Cópia exata do projeto referência (`chamferBox(w, h, d, ch)`), adaptada para `BufferGeometry`:
- Paredes: `chamferBox(0.98, 0.80, 0.98, 0.01)` com bevel 0.01
- Piso: `chamferBox(0.98, 0.12, 0.98, 0.01)`
- Winding corrigido da face superior (top face `q(t0, t3, t2, t1)` em vez de `q(t3, t2, t1, t0)`)
- `DoubleSide` nos materiais para evitar culling de faces chanfradas

### Iluminação (Spaceships and Aliens)
```js
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

var hemi = new THREE.HemisphereLight(0x87CEEB, 0x3a2a1a, 0.35);
var dir = new THREE.DirectionalLight(0xffeedd, 1.2);
dir.position.set(-GRID * 2, GRID * 1.5, GRID * 2); // à direita da câmera
dir.castShadow = true;
dir.shadow.mapSize.set(1024, 1024);
var fill = new THREE.DirectionalLight(0x8899bb, 0.2);
```
- Hemi 0.35 (ambiente baixa pra não matar sombras)
- Key light 1.2 com shadow, fill 0.2
- Shadow bias -0.001, frustum proporcional ao GRID

### Controles de Câmera
- **Pan:** mouse drag + touch drag, com `pixelToWorld()` projetando movimento 2D no plano 3D
- **Zoom:** roda do mouse (fator 1.1× por notch) + pinch (dois dedos mobile)
- **Range zoom:** 0.3× a 4× o fit inicial
- **View responsiva:** Desktop 1000×1000, tablet 600×600, mobile 320×320, `margin: 0 auto`

### Props
6 tipos (console, terminal, pillar, crystal, debris, beacon) com seed determinística:
- Console: corpo + painel + tela emissiva + suporte
- Terminal: mesa + monitor emissivo + teclado
- Pillar: base + fuste + capitel + esfera de topo
- Crystal: cluster de cones + base, emissão roxa
- Debris: dodecaedros irregulares, flatShading
- Beacon: poste + luz emissiva + glow

## Lições para o Spaceships and Aliens

1. **Ângulo 36.7°** é o sweet spot isométrico clássico (opcional, user prefere 55-80°)
2. **ChamferBox** em vez de BoxGeometry dá aspecto polido de miniatura
3. **InstancedMesh** + animação de revelação é ideal para muitas células
4. **Tilt-shift** + bloom + color grade transforma cena 3D em diorama
5. **Shadow dinâmico** com frustum proporcional ao grid
6. **Fog densidade fixa** mantém atmosfera consistente em qualquer escala
7. **Paletas por tema** com variação aleatória por instância quebra repetição
8. **Elevation map** com step walls cria desníveis visíveis sem geometria extra
9. **Seeded RNG** (`mulberry32`) garante mapas determinísticos por seed
10. **Pan+Zoom em ortho**: `pixelToWorld` com cross product + escala do frustum
11. **Compartilhamento por seed**: trafega só `seed + roomCount + paletteKey` (6 bytes), não o grid inteiro — o layout é recalculado deterministicamente no destino via `buildSharedMap()`
