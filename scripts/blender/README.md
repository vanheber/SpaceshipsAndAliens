# Gerador de planetas — Blender + FLUX

`planet.py` é o protótipo v1 (rocky/ocean/gas/ice, luz suave). `planet_v2.py` é o
experimento com rachaduras de lava, poças de magma e terminador; ainda não tem
atmosfera volumétrica nem nuvens volumétricas.

Protótipo local para gerar as capas de planeta da biblioteca. O Blender monta a
geometria, a luz e a composição; o FLUX entra (ou não) no acabamento da
superfície.

## Rodar

```bash
scp scripts/blender/planet.py root@100.87.148.94:/root/planet.py

ssh root@100.87.148.94 "cd /root && blender -b --python planet.py -- \
  --type rocky --seed 7 --out /root/planet.png --size 1024 --samples 64"
```

Tipos: `rocky`, `ocean`, `gas` (aceita `--rings 1`), `ice`.

## Tempo medido (RTX 3060, 1024², 64 samples, denoise)

| Etapa | Tempo |
|---|---|
| Render Blender (inclui startup) | **10–13 s** |
| FLUX img2img (denoise 0.45, 10 steps) | **~54 s** |
| Híbrido (base + IA) | **~65 s por planeta** |
| 42 planetas só no Blender | ~8–9 min |
| 42 planetas no híbrido | ~45 min |

## O que o protótipo já faz

- Esfera com material procedural por tipo: continentes/oceanos, bandas de gás,
  gelo com rachaduras, nuvens e atmosfera.
- Anéis opcionais, starfield, câmera e luz de área com fase.
- Seed controla textura e estrelas; o mesmo seed repete o planeta.

## O que ainda falta para produção

- **Atmosfera**: o rim atual é um anel chapado; o ideal é volume/glow ou
  compositor, para o FLUX não herdar o contorno.
- **Anéis**: o torus está facetado; trocar por disco com alpha procedural.
- **Fase**: a sombra ainda é suave demais; a luz-chave precisa ficar mais
  lateral para o terminador aparecer.
- **Paletas por planeta**: hoje o tipo define a paleta; o ideal é passar cores
  do `index.json` (ex.: Zeta3B dourado, Mortália gelo, Ilúmina deserto).

## Estratégia

- **Só Blender**: rápido (10 s), controlado, mas com cara de CG. Serve para
  thumbnail/card e para rascunho.
- **Híbrido**: Blender fixa geometria/fase/anéis e o FLUX (denoise 0.35–0.45)
  melhora superfície, nuvens e cor. É o caminho para a arte final; 1 seed por
  planeta costuma bastar.
- **Só IA**: rápido, mas sorteia geometria e atmosfera; para um conjunto
  consistente, a curadoria custa mais que o híbrido.


## v3 — camadas (cebola)

`planet_v3.py` implementa a arquitetura de esferas sobrepostas:

1. **superfície** — icosphere subdiv 6 + subsurf + displace; shader com 3 escalas
   de ruído, bump encadeado, oceanos/terra/gelo (ou bandas de gás);
2. **nuvens** — duas cascas com ruídos e escalas diferentes, alpha e bump;
3. **atmosfera** — casca volumétrica (`Principled Volume`) com gradiente esférico;
4. **anéis** — torus fino com bandas e alpha (gas);
5. **fundo** — esfera de nebulosa, ~160 estrelas pequenas e um sol distante;
6. **compositor** — glare/glow (API de node group do Blender 5.2 — ainda instável
   no protótipo; o render atual sai sem ele).

Câmeras: `--camera full|closeup|probe`. Tipos: `terra`, `desert`, `lava`, `ice`,
`gas`.

Tempo medido: **33 s** base (1024², 128 samples, com volumetria) + **53 s** de
img2img = **~86 s por planeta**. O híbrido melhora relevo, nuvens e luzes
noturnas; a atmosfera do Blender se perde no passe de IA e precisa ser
recomposta por cima.


## v4 — a arquitetura de camadas pedida

`planet_v4.py` tenta a pilha completa, sem IA:

1. base (cor, sem bump) + camada de continentes/montanhas (bump) + camada de
   detalhe (bump mínimo);
2. nuvens baixas e altas em cascas separadas;
3. atmosfera volumétrica;
4. anéis opcionais;
5. nebulosa, estrelas e sol;
6. luzes noturnas mascaradas pelo terminador (dot da normal com a direção do sol).

O que funcionou: terminador, silhueta redonda, luzes noturnas, poeira atmosférica.
O que ainda não está no nível das referências: relevo (o displace fica entre
liso e batata), nuvens (finas demais ou invisíveis) e atmosfera (fraca).

O gargalo é a **textura de alta frequência**: ruído de shader em escala
planetária não gera cordilheiras, rios e costas coerentes. O caminho para
resolver no Blender é gerar mapas procedurais 4K (albedo, height, roughness,
nuvens, luzes) localmente e usá-los como image textures + displacement no
Blender — sem IA, mas com detalhe de verdade.


## v5 — mapas procedurais 4K + Blender (sem IA)

`gen_maps.py` gera, com numpy/PIL:

- `albedo.png` (4096×2048) — cor por altura/umidade;
- `height.png` (16-bit) — deslocamento;
- `rough.png` — oceano/terra/gelo;
- `cloud_low.png` / `cloud_high.png` — duas camadas;
- `lights.png` — luzes noturnas em clusters.

`planet_maps.py` (Blender) usa os mapas como image textures: albedo na cor,
height no Displace + Bump, rough na rugosidade, nuvens em duas cascas, lights
multiplicado pela máscara de terminador (dot da normal com o sol), atmosfera
volumétrica e fundo de nebulosa/estrelas.

`post.py` faz o acabamento: bloom das altas luzes, contraste, saturação,
vinheta e grão.

Tempo: mapas ~13 s (4K); render 2048²/160 ~102 s; post ~2 s. A 1024² o
render fica em ~60 s. O gargalo agora é a nitidez da superfície/nuvens, não o tempo.


### Ajustes da última rodada

- mapas com detalhe fino extra (`fine2`, base 48) e `UnsharpMask`;
- nuvens mais perto: cascas 1.012 e 1.018 (antes 1.012/1.022); atmosfera 1.028;
- displace reduzido para 0,02 e bump em 0,95 — evita picos no limbo;
- render 2048²/160 e pós com unsharp.

Ainda falta: nuvens menos algodão (alpha mais macio/3ª camada), paleta com mais
basalto/cinza, rios/costas, rim atmosférico mais forte e um closeup/probe.


### Rodada de nitidez (18/11)

O que estava borrado era o **mapa**, não o render. O height era fBm suave e o
normal map quase plano. Correções:

- height com ridged multifractal em duas escalas + crateras mais fundas;
- **normal map** 4K gerado do height com ganho local (substituiu o bump de height liso);
- albedo com ganho local, grão fino e unsharp 220%;
- nuvens em 1.012/1.018 e atmosfera em 1.028;
- pós com bloom menor e unsharp.

Render 1536²/160 em ~80 s. O relevo agora tem detalhe; o que falta é **forma
grande** (cordilheiras, bacias, vales) — isso pede domain warping e erosão, não
mais ruído.


### Domain warp + erosão (18/11)

- height passou por **domain warping** (4 oitavas, deslocamento ~1,2% do mapa) e
  **erosão térmica** leve (1 passe) — quebra as formas circulares sem virar fibra;
- veios de drenagem no albedo em baixas altitudes;
- normal map 4K do height pós-warp;
- render 1536²/160 em ~80 s.

Resultado: textura nítida, crateras e granulação visíveis. O que ainda falta é
**contraste de macroforma** (planícies vs. cordilheiras) — o relevo é uniforme
demais. Próximo: máscara de macroforma + vales, atmosfera mais forte e nuvens
volumétricas.


### Macroforma e o artefato de meridiano (18/11)

- máscara de macroforma: planície (baixa) / planalto / montanha (ridged);
- cânion acompanhando a contour da macroforma e rede de drenagem;
- **normal map tangent-space foi o culpado das linhas verticais** no render: na
  UV sphere ele cria artefato de meridiano. Troquei por **Bump** do height com
  interpolação **Cubic** — o artefato quase sumiu;
- sobrou um moiré fino do albedo 4K renderizado a 1536; resolve com render 2048
  ou pré-filtro leve no albedo.


### Rollback para o known-good (18/11)

Tentei ruído isotrópico por FFT para matar as estrias verticais. Removeu as
estrias, mas mudou a distribuição de altura, estourou a exposição e trouxe um
artefato de tile. Revertido para o fBm PIL + macroforma + bump/cubic.

Estado atual: render 2048, macroforma, crateras, nuvens, luzes noturnas, sem o
shell de rim (virava anel). As estrias verticais continuam finas no 2048; a
origem é a reamostragem do albedo, não o normal map.

Próximo: gerar albedo/height em 8192 (ou render 4096 e reduzir) para matar a
estria na origem; atmosfera por pós/volume, não por casca; nuvens volumétricas.


### Atmosfera por altitude + nuvens baixas (18/11)

- atmosfera: casca 1.03 com densidade por raio (1.0 → 1.03), ruído de 0,7–1,3,
  cor azul-acinzentada e densidade 0,07; sem shell de Fresnel (o anel duro saiu);
- nuvens: 1.008 e 1.012 (antes 1.012/1.018), displace 0,012;
- resultado: limbo azul fino, sem a bolha marrom da versão anterior.

Ainda: o glow é sutil; pode subir densidade/raio ou entrar com glow no pós. Nuvens
continuam algodão em alguns pontos.


### Atmosfera direcional (18/11)

- densidade da casca multiplicada por `dot(normal_da_posição, direção_do_sol)`:
  0 no lado escuro, até 6× no lado iluminado;
- anisotropia 0,82 (forward scattering), casca 1,07, densidade base 0,14;
- nuvens em 1,008/1,012, displace 0,012.

Resultado: halo azul grosso no lado do sol, quase inexistente no lado escuro.
Ainda é uma casca uniforme; o próximo refinamento é variar o halo com ruído e
dessaturar, ou levar o glow para o pós.


### Atmosfera com cor do solo e degradê (18/11)

- cor por altitude: rampa do vermelho escuro na superfície ao laranja pálido na
  borda, acompanhando o tom do deserto;
- densidade direcional 0–5,5 pelo dot com o sol, casca 1,12 e queda `(1-r)^2,2`;
- anisotropia 0,72; nuvens 1,008/1,012.

Resultado: o lado iluminado ganha um degradê vermelho-poeira que se espalha para
fora; o lado escuro fica limpo. A borda da casca ainda aparece como um fio.


### Oceano escuro + luzes variadas (18/11)

- nível do mar 0,32; shelf claro na costa, fundo escuro;
- shader de água: máscara `water.png`, tinta azul escura, fresnel quente e bump
  de ondas (noise 220);
- luzes: 160 clusters, 25% metrópoles (raio 5–14 px), satélites e intensidades
  variadas; emissão 5×;
- render 2048²/160 em ~4m45.

A opacidade de "buraco" era o oceano preto sem superfície. Com shelf + ondas +
fresnel ele passou a ler como água escura; a costa ainda é dura.


### Investigação: oceano x atmosfera (18/11)

- `water.png` **não está invertido**: branco no oceano, preto na terra (comparado
  com o albedo);
- os nodes da atmosfera **não mudaram** desde o render sem oceano; o que mudou
  foi a superfície: albedo escuro do mar + tinta/fresnel do shader de água;
- a tinta azul rasa foi removida (deixava o mar opaco/chapado) e entrou uma luz
  de preenchimento quente (45 W) para devolver o bounce que a superfície escura
  consumia;
- resultado: mar escuro com shelf, ondas e um glint; atmosfera volta a aquecer.
  A costa ainda é dura e o glint é forte.


### Reversão do oceano (18/11)

- `sea=0` para deserto; removidos o mix de oceano no albedo/roughness, o shader
  de água (tinta/fresnel/ondas) e a luz de preenchimento de 45 W;
- mantidas as **luzes noturnas novas** (160 clusters, metrópoles e satélites);
- superfície e atmosfera voltam ao estado anterior ao oceano.

O próximo passo é decidir a densidade das luzes (a crescente noturna é fina e
mostra poucos clusters) e então 2048/closeup.
