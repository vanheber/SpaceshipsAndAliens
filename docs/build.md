# Build & Deploy

O WARP-Unit é um projeto estático. Nav, footer e outros fragmentos de HTML ficam em `includes/` e são injetados no HTML final via script de build.

## Estrutura

```
├── includes/          # Fragmentos HTML reutilizáveis
│   ├── nav.html       # Barra de navegação + overlay do menu
│   ├── footer.html    # Footer padrão (Termos · Licenciamento)
│   └── footer-index.html  # Footer do index.html (Docs · Diário)
├── prompts/           # Prompts de IA (um arquivo por domínio)
│   ├── planet.js      # Geração de planetas (PlanetPrompts)
│   └── discovery.js   # Geração de encontros (DiscoveryPrompts)
├── *.html             # Páginas fonte com placeholders
│                      # <!--#include nav-->
│                      # <!--#include footer-->
├── build.js           # Script Node.js que resolve includes
├── public/            # Saída do build (gitignored)
└── deploy.sh          # Mirror FTP de public/
```

## Placeholders

Cada página .html na raiz usa comentários HTML como marcadores:

```html
<!--#include nav-->
<!--#include footer-->
```

O `index.html` usa um footer diferente:

```html
<!--#include footer-->  <!-- resolvido como includes/footer-index.html no build -->
```

Os placeholders são ignorados pelo navegador quando o HTML é aberto diretamente (são comentários HTML), então é possível desenvolver sem precisar rodar o build.

## Build

```bash
npm run build
```

O script `build.js`:

1. Lê todos os `.html` da raiz do projeto
2. Substitui `<!--#include nav-->` pelo conteúdo de `includes/nav.html`
3. Substitui `<!--#include footer-->` pelo footer correspondente
4. Copia assets (js/, img/, data/, api/, docs/, warp.css, sw.js, .htaccess, VERSION)
5. Escreve tudo em `public/`

## Deploy

```bash
npm run deploy
```

O script `deploy.sh` usa `lftp` para espelhar a pasta `public/` no servidor FTP configurado em `.env`.

Variáveis necessárias no `.env`:

```
FTP_HOST=ftp.exemplo.com
FTP_USER=usuario
FTP_PASSWORD=senha
FTP_PATH=/public_html
FTP_PORT=21
```

## Nav no index.html

No `index.html`, a barra de navegação fica visível apenas quando a tela de entrada não está ativa. Isso é控制ado por CSS:

```css
body:has(.entry-screen.active) { padding-top: 0; }
body:has(.entry-screen.active) .warp-nav { display: none; }
```

Quando o jogador entra (P2P) ou o GM acessa o modo leitura (`?readonly=1`), a entry screen perde a classe `.active` e o nav aparece automaticamente.

## Prompts de IA

Os prompts do Gerador de Missão ficam em `prompts/`, separados por domínio:

- **`prompts/planet.js`** — `PlanetPrompts`: sistema + template para gerar planetas
- **`prompts/discovery.js`** — `DiscoveryPrompts`: sistema + template para gerar eventos/encontros

Cada arquivo expõe `window.NomePrompts = { system: fn, user: fn(params) }`. O `system()` retorna o system prompt fixo; o `user()` monta o user prompt com os parâmetros dinâmicos da cena.

Para refinar um prompt, abra o arquivo isoladamente, cole o conteúdo num chat de IA para iterações e substitua pela versão melhorada — sem enviar a página inteira.

## Adicionar novo fragmento

1. Crie o arquivo em `includes/` (ex.: `includes/analytics.html`)
2. No `build.js`, carregue o conteúdo no objeto `includes`
3. Nas páginas HTML, adicione `<!--#include analytics-->`
4. Se precisar de tratamento especial por página, adicione a lógica no `build.js`
