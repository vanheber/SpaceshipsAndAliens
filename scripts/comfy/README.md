# ComfyUI — lote de arte do Spaceships and Aliens

Experimento local no **hal9000** (RTX 3060 8 GB) com o **FLUX.2 Klein 4B
distilled FP8** — o único motor de imagem instalado lá. É um modelo pequeno e
destilado: serve para **rascunho e exploração**, não para substituir a arte
aprovada (Midjourney/Flux Pro).

## O que funciona e o que não funciona

| Assunto | Expectativa |
|---|---|
| Locais, ambientes, interiores (16:9) | **Bom** — é o melhor encaixe do modelo |
| Criaturas, alienígenas, robôs (1:1) | **Razoável** — 4–6 seeds e curadoria; o artefato lê como biologia alienígena |
| Naves e objetos (1:1) | **Razoável** — silhueta e material ok; detalhe fino e consistência são o teto |
| Pessoas, rostos, mãos | **Fraco** — o próprio cliente do hal9000 manda foto realista para serviço premium |
| Insígnias, mapas, diagramas, texto | **Não usar** — é design vetorial, não difusão |

O truque para chegar perto da arte aprovada é **img2img** a partir de uma
imagem aprovada (denoise 0,55–0,65): herda paleta, luz e composição. Depois,
upscale no Mac (Upscayl) e curadoria.

## Rodar

```bash
# conferir o que vai ser gerado, sem GPU
python3 scripts/comfy/run.py --batch 1 --dry-run

# lote 1 (5 fichas × 4 seeds = 20 imagens)
python3 scripts/comfy/run.py --batch 1

# teste rápido: 2 seeds por ficha
python3 scripts/comfy/run.py --batch 1 --seeds 2

# só uma ficha
python3 scripts/comfy/run.py --batch 1 --only cripter,holodisco
```

O script fala HTTP direto com `100.87.148.94:8188` (não passa por SSH). Se o
hal9000 estiver dormindo, ele para com uma mensagem clara — acorde antes com
`infra hal status` / `infra hal wake`.

Saída: `renders/sna-art/batch-<n>/` (ignorado pelo git), com uma pasta por
ficha, `results.json` e **`contact.html`** para revisar os seeds lado a lado.

## `jobs.json`

```json
{
  "style": "sufixo fixo de estilo",
  "jobs": [
    {
      "id": "loc-anel-de-gelo",
      "batch": 1,
      "category": "location",
      "title": "O anel de gelo",
      "size": [1344, 768],
      "steps": 12,
      "seeds": [101, 102, 103, 104],
      "prompt": "descrição em inglês, positiva",
      "ref": "/caminho/para/referencia.webp",
      "denoise": 0.62
    }
  ]
}
```

- `ref` + `denoise` são opcionais; sem eles é t2i.
- Tamanhos múltiplos de 16: `1024x1024` (card/lore), `1344x768` (local 16:9),
  `832x1216` (capa 2:3).
- `--steps` e `--seeds` sobrescrevem o JSON.
- Prompts em inglês e **positivos** (o fluxo zera o negativo). Evite "no text";
  descreva o que quer ver.

## Primeiro lote

1. **O anel de gelo** — local 16:9 (teste de ambiente).
2. **Ciclopes** — robô de um olho (teste de criatura/objeto).
3. **Cripter** — nave por img2img de uma nave aprovada (teste de consistência).
4. **Holodisco** — cristal macro (teste de objeto).
5. **Ciclone** — planeta de cristais (teste de planeta alienígena).

O lote 2 já tem Robô, Scorpion e X-Síntese como continuação. Se o lote 1
convencer, o próximo passo é cobrir as 20 pranchas de local das missões.

## Kit reusado em outro título

O `run.py` é genérico: lê qualquer `--jobs` e escreve onde o `--out` mandar. As
pranchas da **Peregrinação Azul** (33 locais, fantasia medieval) usam os mesmos
arquivos com os jobs à parte:

```bash
python3 scripts/comfy/run.py --jobs scripts/comfy/jobs-peregrinacao.json --out <dir>
```

- `jobs-peregrinacao.json` — 30 locais (10 aventuras × 3), seeds 401+.
- `jobs-peregrinacao-retakes.json` — refação dos 6 que saíram errados.
- `jobs-peregrinacao-alianca.json` — os 3 locais da Aliança do Leste (não vêm
  do `md`, e sim do `scripts/peregrinacao-content.js` do portal).
- `jobs-peregrinacao-vale.json` / `-sol.json` — segunda tentativa pontual.

**Duas armadilhas aprendidas no lote:**

1. **A palavra "octane" no `style` faz o modelo assinar a imagem.** Algumas
   seeds saem com "OCTANE" gravado no canto inferior (esquerdo ou direito).
   Confira os dois cantos de baixo antes de aprovar; se o resto estiver bom,
   troque a seed — não corte a imagem.
2. **Descreva o vazio, não o "sem gente".** "empty", "deserted", "abandoned"
   funcionam; "no people" (negativo) não existe nesse fluxo — o `ConditioningZeroOut`
   zera o negativo e a frase vira assunto. Quando o prompt pede "shadow of a
   colossus", o modelo desenha o colosso: peça **a sombra vista de cima**.
