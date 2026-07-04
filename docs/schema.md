# Schema de Dados

A engine WARP carrega dados de arquivos JSON externos. Para criar seu próprio tema ou catálogo, siga os schemas abaixo.

---

## Catálogo e Configuração

### `data/robots.json`

Array de objetos com a seguinte estrutura:

```json
{
  "id": "identificador-unico",
  "model": "Nome do Personagem",
  "type": "Classe ou Função",
  "tagClass": "tag-combat | tag-science | \"\"",
  "desc": "Descrição narrativa (exibida no catálogo)",
  "attack": 3,
  "intellect": 1,
  "ca": 15,
  "abilityName": "Nome da Habilidade",
  "abilityValue": 2,
  "abilityDesc": "Descrição da habilidade (exibida na ficha)",
  "startingEnergy": 6,
  "maxEnergy": 12,
  "image": "img/nome-do-arquivo.webp"
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | string | Identificador único (usado para busca interna) |
| `model` | string | Nome exibido no catálogo e ficha |
| `type` | string | Classe, função ou especialidade |
| `tagClass` | string | Classe CSS da tag: `"tag-combat"`, `"tag-science"` ou `""` |
| `desc` | string | Texto descritivo no card do catálogo |
| `attack` | number | Modificador de ataque |
| `intellect` | number | Modificador de inteligência |
| `ca` | number | Classe de armadura |
| `abilityName` | string | Nome da habilidade especial |
| `abilityValue` | number | Modificador da habilidade |
| `abilityDesc` | string | Descrição da habilidade na ficha |
| `startingEnergy` | number | Energia inicial da unidade |
| `maxEnergy` | number | Energia máxima (recomendado: 2x `startingEnergy`) |
| `image` | string | Caminho relativo da imagem (ex: `"img/arquivo.webp"`) |

### `data/config.json`

Configuração do drone de backup:

```json
{
  "drone": {
    "name": "Drone Limitado (M-1)",
    "subtitle": "Chassi substituto temporário",
    "ca": 10,
    "attack": 0,
    "intellect": 0,
    "maxEnergy": 6,
    "startingEnergy": 3,
    "image": "img/backup.webp",
    "modifierLabel": "Sem modificador (Drone)",
    "toggleActiveLabel": "Destruição: Acionar Protocolo Drone",
    "toggleInactiveLabel": "Chassi Pronto: Sincronizar"
  }
}
```

---

## Gerador de Missão

### Geração Procedural de Planetas

Desde v2.0, planetas são gerados via **sorteio procedural + síntese por IA**. Um sistema local sorteia uma palavra de cada categoria de atributo planetário; a IA recebe esses parâmetros como âncoras e sintetiza uma descrição coerente, encontrando conexões inesperadas entre eles. O trabalho da IA é *combinar* peças, não *inventar* do zero — isso elimina loops criativos e garante variedade combinatória real.

#### `data/planet-params.json`

Arrays de palavras por categoria. A cada geração, uma palavra de cada array é sorteada.

```json
{
  "superficie": ["rochoso", "oceânico", "deserto de areia", "gelo", "selva", "pântano", ...],
  "bioma": ["floresta", "tundra", "deserto", "savana", "recifes", "montanhas", ...],
  "atmosfera": ["respirável", "tóxica", "corrosiva", "rarefeita", "densa", ...],
  "clima": ["congelante", "tropical", "árido", "temperado", "vulcânico", ...],
  "orbita": ["normal", "acoplado tidal", "estrela binária", "órbita excêntrica", ...],
  "gravidade": ["micro", "baixa", "padrão", "alta"],
  "fauna": ["insetos coloniais", "voadores", "aquáticos", "simbiótica", "predadora", ...],
  "flora": ["liquens", "musgos", "fungos", "árvores", "flutuante", "extremófila", ...],
  "recursos": ["minerais raros", "água líquida", "cristais energéticos", "gases nobres", ...],
  "perigo": ["radiação de fundo", "tempestades severas", "instabilidade geológica", ...]
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `superficie` | string[] | Tipo dominante de superfície (12 opções) |
| `bioma` | string[] | Bioma predominante (9 opções) |
| `atmosfera` | string[] | Composição atmosférica (9 opções) |
| `clima` | string[] | Clima do planeta (9 opções) |
| `orbita` | string[] | Característica orbital (8 opções) |
| `gravidade` | string[] | Nível de gravidade (4 opções) |
| `fauna` | string[] | Fauna dominante (9 opções) |
| `flora` | string[] | Flora dominante (10 opções) |
| `recursos` | string[] | Recurso notável (8 opções) |
| `perigo` | string[] | Perigo ambiental principal (9 opções) |

**Total de combinações**: ~1.8 bilhão de planetas diferentes.

**Fallback**: se a IA falhar, o gerador monta uma descrição procedural concatenando as palavras sorteadas. Se os JSONs não carregarem, cai no fallback clássico via `planet-types.json`.

---

### Geração Procedural de Descobertas (Eventos)

Descobertas seguem o mesmo princípio: sorteio procedural de parâmetros + síntese por IA. O sistema opera com dois arquivos: parâmetros gerais de cena e categorias de evento.

#### `data/events-params.json`

Parâmetros gerais sorteados em toda descoberta:

```json
{
  "cena": ["ruínas alienígenas", "naufrágio de nave", "campo de destroços", "ecossistema único", ...],
  "origem": ["natural", "artificial alienígena", "humana pré-expansão", "acidental", ...],
  "estado": ["operacional", "abandonado", "deteriorando", "hibernando", "corrompido", ...],
  "elemento_chave": ["criatura viva", "máquina funcional", "dados legíveis", "sobrevivente", ...],
  "recompensa": ["dados de navegação", "tecnologia utilizável", "minério raro", "aliado em potencial", ...],
  "tom": ["urgente", "ameaçador", "melancólico", "curioso", "desesperado", "sombrio", ...],
  "encontros": [0, 0, 0, 1]
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `cena` | string[] | Contexto visual da descoberta (16 opções) |
| `origem` | string[] | Proveniência do elemento encontrado (8 opções) |
| `estado` | string[] | Condição atual do cenário (9 opções) |
| `elemento_chave` | string[] | O coração narrativo da descoberta (12 opções) |
| `recompensa` | string[] | O que a tripulação ganha (12 opções) |
| `tom` | string[] | Qualidade emocional do evento (10 opções) |
| `encontros` | number[] | Probabilidade de inimigo conhecido (`[0,0,0,1]` = 25%) |

#### `data/events-categories.json`

Categorias de evento com palavras específicas. A cada descoberta sorteia-se uma categoria e depois uma palavra dentro dela:

```json
{
  "resgate": ["tripulação perdida", "cápsula de escape", "nave à deriva", ...],
  "escolta": ["carga sensível", "comboio minerador", "diplomata em trânsito", ...],
  "encontro": ["comércio interestelar", "estação neutra flutuante", ...],
  "pesquisa": ["coleta de amostras", "levantamento geológico", "escavação arqueológica", ...],
  "perigo": ["colapso estrutural iminente", "criatura à solta", "explosão em cadeia", ...],
  "naufrágio": ["destroços orbitais recentes", "estação abandonada", "cemitério de naves de guerra", ...],
  "anomalia": ["distorção temporal localizada", "bolha de espaço dobrado", ...],
  "nave": ["falha de sistema em cascata", "intruso não identificado", "conspiração entre androides", ...]
}
```

| Categoria | Palavras | Mapeia para `encounterType` |
|---|---|---|
| `resgate` | 8 | rescue |
| `escolta` | 7 | rescue |
| `encontro` | 7 | planet |
| `pesquisa` | 7 | planet |
| `perigo` | 8 | planet |
| `naufrágio` | 7 | space |
| `anomalia` | 7 | space |
| `nave` | 8 | ship |

**Total de combinações**: ~98 milhões de descobertas diferentes.

#### Inimigos (`data/enemies.json`)

Quando `encontros` sorteia `1`, um inimigo conhecido é injetado na descoberta. O inimigo pode ser ameaça, oportunista, vítima ou aliado — a IA decide o papel com base no contexto.

```json
[
  {
    "nome": "Piratas Espaciais",
    "desc": "Saqueadores de rotas comerciais que operam em bandos de 3 a 5 naves leves..."
  },
  {
    "nome": "Reptilus",
    "desc": "Raça reptiliana humanoide com tecnologia de salto interestelar própria..."
  }
]
```

| Campo | Tipo | Descrição |
|---|---|---|
| `nome` | string | Nome do inimigo (exibido nos logs) |
| `desc` | string | Descrição narrativa de 2-3 frases |

---

#### `data/planet-types.json`

_Fallback clássico._ Usado apenas quando os JSONs de parâmetros procedurais não carregam (erro de rede).

```json
[
  {
    "type": "Deserto de Sílica",
    "desc": "Um mundo árido coberto por dunas de areia vítrea..."
  }
]
```

| Campo | Tipo | Descrição |
|---|---|---|
| `type` | string | Nome do tipo de planeta (exibido como badge) |
| `desc` | string | Descrição atmosférica de 2-3 frases em português |

### `data/planet-names.json`

Componentes para geração procedural de nomes no formato `XX-999a`:

```json
{
  "codes": ["KX", "TD", "OP", "XR", "VY", "ZQ", "NF", "HS"],
  "prefixes": ["Nova", "Épsilon", "Gama"],
  "suffixes": ["Prime", "Minor", "Boreal"]
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `codes` | string[] | Códigos de 2 letras para o prefixo do nome |
| `prefixes` | string[] | Prefixos descritivos (legado, não mais usados) |
| `suffixes` | string[] | Sufixos descritivos (legado, não mais usados) |

### `data/discoveries.json`

_Fallback clássico._ Estrutura com pools de descoberta usados quando os JSONs procedurais (`events-params.json` + `events-categories.json`) não carregam:

```json
{
  "categories": { "fauna": ["..."], "flora": ["..."], "ruins": ["..."], ... },
  "locations": ["local 1", "local 2"],
  "perils": { "fauna": ["ameaça 1"], "flora": ["..."], ... },
  "rewardTypes": ["recursos", "artefatos", ...],
  "rewardLabels": { "recursos": "RECURSOS", ... },
  "rewards": { "recursos": ["..."], "artefatos": ["..."], ... },
  "spaceEncounters": { ... },
  "shipEvents": { ... },
  "rescueMissions": { ... }
}
```

### Geração por IA (fluxo atual)

Desde v2.0, a IA não inventa livremente — ela **sintetiza** a partir de parâmetros procedurais:

1. **Planetas**: sorteia 1 palavra de cada categoria em `planet-params.json` → IA recebe os atributos e gera nome + tipo + descrição que incorpora todos eles
2. **Descobertas**: sorteia 1 palavra de cada categoria em `events-params.json` + 1 categoria e palavra de `events-categories.json` → IA recebe os parâmetros e gera um encontro completo (tipo, abordagem, descrição, local, perigo, recompensa)
3. **Inimigos**: se `encontros === 1` (25% de chance), sorteia inimigo de `enemies.json` e o injeta no prompt — a IA decide o papel do inimigo (ameaça, oportunista, vítima, aliado)

Se a IA falha (todos os provedores exauridos), o gerador cai no sistema local procedural, que monta descrições concatenando as palavras sorteadas. Se nem os JSONs carregarem, cai no fallback clássico via `planet-types.json` e `discoveries.json`.

---

## API de Campanha & Sessão

### Armazenamento: `data/campaigns/{id}.json`

```json
{
  "id": "abc123def456",
  "name": "Fronteira de KX-415",
  "joinCode": "XK42",
  "archived": false,
  "createdAt": "2026-07-03T10:00:00Z",
  "state": {
    "robots": { "sentinel": 5, "analyst": 3 },
    "npcs": [5, 5, 5],
    "fear": 0,
    "mothership": { "sup": {"current":10,"max":20}, "fuel": {"current":10,"max":10} },
    "ship400i": { "sup": {"current":4,"max":8}, "fuel": {"current":6,"max":6} },
    "activeRobot": "sentinel",
    "isDroneMode": false
  },
  "pendingActions": [
    { "id": "req-abc123", "type": "energyIncrement", "robotId": "sentinel", "amount": 1, "requestedAt": "..." }
  ],
  "messages": [
    { "id": "msg-abc123", "from": "gm", "to": "sentinel", "text": "Cuidado com a armadilha!", "sentAt": "...", "read": false }
  ],
  "sessions": [
    {
      "id": "s1",
      "name": "KX-415b",
      "startedAt": "2026-07-03T20:00:00Z",
      "endedAt": "2026-07-03T23:30:00Z",
      "startState": { },
      "endState": { },
      "notes": "Combate com piratas. Robert C9 perdeu 2E.",
      "planets": [
        {
          "name": "KX-415b",
          "type": "Deserto de Sílica",
          "desc": "Mundo árido com dunas de areia vítrea...",
          "discoveries": [
            { "index": 1, "encounterType": "planet", "approach": "...", "description": "...", "location": "...", "peril": "...", "perilDC": 14, "reward": "..." }
          ]
        }
      ]
    }
  ]
}
```

### Endpoints (`api/campaign.php`)

| Action | Método | Auth | Descrição |
|--------|--------|------|-----------|
| `create` | POST | GM | Cria campanha, gera joinCode de 4 letras |
| `save` | POST | GM | Salva estado completo da campanha |
| `load` | GET | Código | Carrega campanha por id + código |
| `poll` | GET | Código | Polling: estado, pendingActions, sessions, messages |
| `list` | GET | GM | Lista campanhas não-arquivadas |
| `archive` | POST | GM | Arquiva campanha (`archived: true`) |
| `delete` | POST | GM | Remove permanentemente |
| `request` | POST | Código | Jogador solicita alteração de energia (±1 a ±3) |
| `confirm` | POST | GM | Aprova pendingAction e aplica delta |
| `reject` | POST | GM | Remove pendingAction sem aplicar |
| `startsession` | POST | GM | Inicia sessão com timestamp e snapshot |
| `endsession` | POST | GM | Encerra sessão, salva endState e notas |
| `saveplanet` | POST | GM | Adiciona planeta + descobertas à sessão ativa |
| `restoresession` | POST | GM | Restaura estado da campanha para endState da sessão |
| `updatenotes` | POST | GM | Atualiza anotações da sessão ativa |
| `sendmessage` | POST | GM/Código | Envia mensagem (`from`, `to`, `text`) |
| `dismissmessage` | POST | GM/Código | Remove mensagem por id |

### Autenticação

- **GM**: cookie `warp_auth` (HMAC-SHA256, 30 dias) via `api/auth.php` (bcrypt + TOTP)
- **Jogador**: joinCode de 4 letras como parâmetro `code` nos endpoints públicos

### Sincronização

- Polling de 3 segundos no cliente (`WarStore` modo remoto)
- `ponytail:` polling simples, ceiling ~8 jogadores simultâneos. Upgrade: SSE.
- `flock(LOCK_EX)` em todas as escritas no servidor. `ponytail:` ceiling ~5 escritas/segundo. Upgrade: SQLite.

### Provedores de IA (cascade)

A geração tenta provedores em ordem até um responder:

1. **Gemini** (Google AI) — via proxy local `/api/proxy.php`, requer autenticação
2. **NVIDIA DeepSeek V4 Flash** — via proxy local `/api/proxy-nvidia.php`
3. **Pollinations.ai** — gratuito, endpoint público, sem chave
4. **Hermes** (Llama 3.1 8B) — fallback externo
5. Fallback para sistema procedural local

**Temperatura**: `1.2` em todas as chamadas.

**Contexto de campanha**: quando `oneshot.html` é aberto com `?campaign=&code=`, o `buildCampaignContext()` injeta estado dos robôs e recursos da nave no prompt da IA.

---

## Exemplo: Tema Fantasia Medieval

Para adaptar o sistema a fantasia medieval, edite `config.json`:

```json
{
  "drone": {
    "name": "Pagem Reserva",
    "subtitle": "Aprendiz convocado às pressas",
    "ca": 8,
    "attack": 0,
    "intellect": 0,
    "maxEnergy": 4,
    "startingEnergy": 2,
    "image": "img/pagem.webp",
    "modifierLabel": "Sem bônus (Pagem)",
    "toggleActiveLabel": "Herói Caído: Chamar Pagem",
    "toggleInactiveLabel": "Herói Recuperado: Dispensar Pagem"
  }
}
```
