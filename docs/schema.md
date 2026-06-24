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

### `data/planet-types.json`

Array de objetos com tipos de planeta e descrições atmosféricas:

```json
[
  {
    "type": "Deserto de Sílica",
    "desc": "Um mundo árido coberto por dunas de areia vítrea..."
  },
  {
    "type": "Selva Bioluminescente",
    "desc": "Uma densa cobertura vegetal emite um brilho azul-esverdeado..."
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

Estrutura com todos os pools de descoberta, incluindo encontros espaciais, eventos de bordo e missões de resgate:

```json
{
  "categories": {
    "fauna": ["descrição 1", "descrição 2"],
    "flora": ["..."],
    "ruins": ["..."],
    "phenomenon": ["..."],
    "resource": ["..."],
    "danger": ["..."]
  },
  "locations": ["local 1", "local 2"],
  "perils": {
    "fauna": ["ameaça 1", "ameaça 2"],
    "flora": ["..."],
    "ruins": ["..."],
    "phenomenon": ["..."],
    "resource": ["..."],
    "danger": ["..."]
  },
  "rewardTypes": ["recursos", "recursos", "artefatos", "componentes", "componentes", "misterios"],
  "rewardLabels": {
    "recursos": "RECURSOS",
    "artefatos": "ARTEFATO",
    "componentes": "COMPONENTE",
    "misterios": "MISTÉRIO"
  },
  "rewards": {
    "recursos": ["recompensa 1", "recompensa 2"],
    "artefatos": ["..."],
    "componentes": ["..."],
    "misterios": ["..."]
  }
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `categories` | object | 6 categorias (fauna, flora, ruins, phenomenon, resource, danger), cada uma com array de descrições narrativas |
| `locations` | string[] | 14 locais possíveis para cada descoberta |
| `perils` | object | Ameaças por categoria, mesma estrutura de `categories` |
| `rewardTypes` | string[] | Tipos de recompensa para seleção ponderada (recursos aparece 2x = mais comum) |
| `rewardLabels` | object | Rótulos de exibição para cada tipo de recompensa |
| `rewards` | object | Descrições de recompensa por tipo |

### `rescueMissions` (dentro de discoveries.json)

Missões de resgate com sobreviventes, naves à deriva e sinais de socorro:

```json
{
  "rescueMissions": {
    "categories": {
      "distress_signal": ["descrição 1", "descrição 2"],
      "survivors": ["..."],
      "stranded_vessel": ["..."]
    },
    "locations": ["local 1", "local 2"],
    "perils": {
      "distress_signal": ["ameaça 1", "ameaça 2"],
      "survivors": ["..."],
      "stranded_vessel": ["..."]
    }
  }
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `categories` | object | 3 categorias (distress_signal, survivors, stranded_vessel), cada uma com array de descrições narrativas |
| `locations` | string[] | Locais onde os resgates ocorrem |
| `perils` | object | Ameaças por categoria, mesma estrutura de `categories` |

### Tipos de Encontro

O gerador de missão sorteia entre 4 tipos de encontro (25% cada):

| Tipo | Contexto | Abordagens |
|---|---|---|
| `planet` | Superfície planetária | arduous, sudden, resting |
| `space` | Espaço/órbita | proximity, longscan, distress |
| `ship` | A bordo da Tiburon | alert, routine, report |
| `rescue` | Resgate de sobreviventes | emergency, cautious, calculated |

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
