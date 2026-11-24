# Biblioteca do Universo (Lore)

O lore do universo vive em `data/lore/` — prosa em Markdown (`*.md`) + metadados em `index.json`. A página `lore.html` monta uma árvore hierárquica a partir dos campos `id`/`parent` e renderiza a prosa via `marked`.

## Árvore hierárquica

```
Sistema Estelar
└── Planeta
    ├── Personagem (personagens principais, se houver)
    └── Geografia (flora/fauna, se houver)
        └── Espécie (se houver)
            ├── Subespécie (se houver)
            ├── Cultura e História
            └── Tecnologias (naves, equipamentos, instrumentos)
```

- **Naves** e **inteligências artificiais** ficam em `tech` de Humanos (Sistema Sol) ou da espécie dona.
- **Subespécies** são entradas `species` cujo `parent` é o `id` da espécie-mãe.
- Conteúdo sem mundo específico: sob o nó **`general`** (`history`, `organization`).
- Entidades entre dimensões: sob o nó **`interdimensional`**.
- Irmãos na árvore são ordenados alfabeticamente (pt-BR).

## Como adicionar uma entrada

1. Crie `data/lore/<tipo>/<id>.md` — prosa em Markdown puro, sem frontmatter. Título `# Nome`, seções `##`, 8-25 linhas.
2. Adicione um objeto ao `data/lore/index.json`:

```json
{
  "id": "ninive",
  "file": "planet/ninive.md",
  "name": "Ninive",
  "type": "planet",
  "parent": "sistema-zeta3",
  "summary": "Metrópole interestelar.",
  "tags": ["mundo"]
}
```

| Campo | Descrição |
|---|---|
| `id` | Identificador único (slug), referenciado por `parent` |
| `file` | Path do `.md` relativo a `data/lore/` (`<tipo>/<id>.md`) |
| `name` | Nome de exibição |
| `type` | `system` \| `planet` \| `character` \| `geography` \| `species` \| `culture` \| `tech` \| `general` \| `interdimensional` \| `organization` \| `history` |
| `parent` | `id` da entrada pai na árvore; omitido em entradas de topo (`system`, `general`, `interdimensional`) |
| `image` | (opcional) Path da imagem, ver [Imagens](#imagens-opcionais) |
| `summary` | Uma frase exibida na árvore |
| `tags` | Usados na busca da página |

Nenhuma mudança de código é necessária — o build copia `data/` inteiro para `public/` automaticamente.

## Personagens (`character`)

Personagens principais usam `type: "character"` e **aninham sob o planeta de origem**: `"parent": "<id do planeta>"`.

```json
{
  "id": "regis-v4",
  "file": "character/regis-v4.md",
  "name": "Regis V4",
  "type": "character",
  "parent": "terra-2",
  "summary": "Tanque de linha de frente.",
  "tags": ["androide"]
}
```

Arquivo correspondente: `data/lore/character/regis-v4.md`.

## Imagens (opcionais)

Cada entrada pode ter **uma imagem** (ou nenhuma):

1. Coloque o arquivo na **mesma pasta do `.md`**, com o mesmo nome base: `data/lore/<tipo>/<id>.webp`.
2. Referencie no `index.json`:

```json
"image": "data/lore/planet/ninive.webp"
```

- Sem o campo `image`, a entrada renderiza sem thumbnail — nada quebra.
- Formato recomendado: WebP (padrão do site).
- O caminho é relativo à raiz do site (`lore.html` fica na raiz).
- Para embutir no texto da entrada, use markdown: `![alt](data/lore/planet/ninive.webp)`.

**Arte fora do lore.** `data/lore/` é árvore **publicável**: o que está lá sobe no site do
jogo e é espelhado na Biblioteca do Universo do portal. Arte sem ficha (elenco de
personagens, estudos, arte de terceiros) fica em **`data/elenco/`**, fora do lore e fora
do espelho.

## Geração com IA

| Ferramenta | Uso |
|---|---|
| `prompts/lore.js` (`LorePrompts`) | Template para converter texto-fonte em entrada completa `{ index, md }`. `system(canon)` aceita cânone opcional. |
| `scripts/populate-lore.js` | População em lote de um corpus via Gemini — idempotente. Etapas: `--stage species\|worlds\|factions\|tech`, `--all`, `--plan`. Requer `GEMINI_KEY` no `.env`. |
| `scripts/extract-sa.js` | Extração direta do sourcebook (sem IA). Etapas: `--stage systems\|planets\|ships\|orgs\|history\|ai`, `--all`, `--force`. |

Esquema detalhado em [schema.md](schema.md).