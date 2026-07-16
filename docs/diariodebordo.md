# Diário de Bordo — Registros de Missão

O **Diário de Bordo** (`diariodebordo.html`) exibe os relatos narrativos (contos) das missões em formato Markdown (.md).

## Estrutura dos Arquivos

Os arquivos ficam em `diariodebordo/` e são registrados no array `MISSIONS` em `diariodebordo.html`.

### Registro de nova missão

Edite `diariodebordo.html` e adicione ao array:

```js
{ file: "missaoXX.md", title: "Missão NOME", date: "3142-XXX", summary: "Descrição curta..." }
```

### Formato do .md

```markdown
<!-- audio: https://exemplo.com/audio.mp3 -->
## Data: 3142-XXX
# Título

Texto do conto em Markdown...
```

## Áudio

Para adicionar um player de áudio à missão, insira na **primeira linha** do arquivo `.md`:

```markdown
<!-- audio: URL_DO_MP3 -->
```

O player aparece automaticamente no topo da página. O formato MP3 é o recomendado.

## Metadados

- `## Data:` — data estelar exibida no topo do registro
- `# Título` — título do conto (opcional)

O resto é Markdown livre: `##` para seções, `**negrito**`, `*itálico*`, listas, `---` para separadores.
