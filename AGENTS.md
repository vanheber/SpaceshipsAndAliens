# Spaceships and Aliens: estilo lazydir

Antes de escrever código, pare no primeiro degrau que segurar:

1. **Precisa existir?** (YAGNI) — se não for pedido, não inventa.
2. **Já existe no código?** Reusa o helper, util ou padrão que já está aqui. Não reescreve.
3. **Biblioteca padrão já faz?** Usa. Three.js, fetch, localStorage — não embrulha em camadas.
4. **Plataforma já faz?** `<input type="date">`, `details/summary`, `dialog` — usa.
5. **Dependência já instalada?** Usa. Não adiciona nova sem precisar.
6. **Dá pra ser uma linha?** Faz uma linha.
7. **Só então:** o mínimo que funciona.

**Bug** = causa raiz, não sintoma: um relatório nomeia um sintoma. Dá grep em quem chama a função e conserta a função compartilhada uma vez — um guard lá é um diff menor que um por caller.

**Regras:**
- Nenhuma abstração que não foi pedida.
- Nenhuma dependência nova se dá pra evitar.
- Nenhum boilerplate que ninguém pediu.
- Deleção sobre adição. Entediante sobre engenhoso. Menos arquivos possível.
- Diff mais curto possível vence, mas só depois de entender o problema.
- Questionar pedidos complexos: "Você realmente precisa de X, ou Y cobre?"
- Comentários `ponytail:` em atalhos intencionais com ceiling conhecido (lock global, O(n²), heurística ingênua) — nomeia o teto e o caminho de upgrade.
- Toda lógica não-trivial deixa UM teste executável (um assert, demo, ou self-check). Uma linha trivial não precisa.

**Não cortar:** validação em trust boundary, tratamento de erro que previne perda de dados, segurança, acessibilidade, o que foi explicitamente pedido.

**Spaceships and Aliens specífico:** os dados 3D com Three.js e os prompts de IA são o charme do projeto — não reduzir. Estilo visual (CSS, badges, banners) também não — o jogo precisa de atmosfera.

# Regras de melhoria (improve)

**Workflow:** auditar → planejar em `plans/` → executar via subagente separado.
- A auditoria (**/improve**) é modo *read-only*. Nunca edita código — só investiga e produz planos.
- Planos são auto-contidos: paths exatos, excerpts do estado atual, passos ordenados, comandos de verificação, critérios de done.
- Execução é delegada a subagente barato (Gemma 4). O agente principal revisa o diff e dá o veredito.
- Depois de executar, **fecha o loop**: atualiza AGENTS.md com os novos padrões descobertos.

**Padrões descobertos nas execuções anteriores:**

| Padrão | Onde | Regra |
|--------|------|-------|
| Chave de API do usuário | `login.html`, `oneshot.html` | Keys em `localStorage` com prefixo `sna-*-key`; nunca no servidor |
| Gemini direto (CORS) | `oneshot.html` | `?key=` na URL da Google AI API — sem proxy, Google suporta CORS |
| NVIDIA key via header | `api/proxy-nvidia.php` | Cliente envia `X-API-Key`, proxy repassa como `Authorization: Bearer` |
| DOM handlers pendurados | `oneshot.html` | `innerHTML = ""` no container pra matar listeners antes de esconder/seção |
| Catch vazio | `oneshot.html` | Nunca `catch (e) {}` sem diagnóstico — no mínimo `console.warn` |
| Guarda de estado global | `oneshot.html` | `if (!planet) return;` no topo de funções que acessam estado sem dono claro |
| Verificação PHP | Todos | `php -l` depois de qualquer edição em `.php` |

| Sanitização de IA | `oneshot.html` | `esc()` helper HTML-escape antes de innerHTML com conteúdo gerado por IA |
| Prompt injection | `oneshot.html` | Dados gerados por IA no prompt seguinte delimitados com `[DATA]...[/DATA]` |
| Rate limit PHP | `api/rate-limit.php` | Arquivo-based, sem dependências; `ponytail:` nomeia ceiling de race condition |
| Service Worker cache | `sw.js` | Network-first pra navegações (HTML), cache-first pra assets estáticos; `?v=N` no registration URL |
| SW version bust | `.htaccess` + `*.html` | `Cache-Control: no-cache` pra sw.js + `register("/sw.js?v=N")` em todas as páginas HTML |
| SW on all pages | `*.html` | Registrar SW em TODAS as páginas HTML, não só na index — senão navegação direta pra oneshot/mothership/etc não é interceptada |
| SW bust por conteúdo | `sw.js` | cache-first de assets: CSS/HTML mudaram → `CACHE = "sna-vN+1"`; `?v=` em script não refresca asset já cacheado |
| Sala wai (Fase E) | `play.html` | `<section id="wai-room">` via importmap → `js/vendor/{wai,table,sync}.js` copiados pelo `build.js` **pós** `cleanRemoved`; `queueMicrotask(() => table.grant(seat, ...))` (grant síncrono não cola); labels PT via `STATES`/`BANDS` |
| Transporte híbrido | `play.html` | UM `connect()` só: `send` = fan-out BC+P2P, `onMessage` = fan-in (Set de wrappers); dois `connect()` ecoariam snapshot |
| Fusão de seats | `play.html` | snapshot recebido funde `{...table.toJSON().seats, ...m.seats}` antes do `load` — sem isso re-grant por-lado briga; `ponytail:` revoke não cola (kick exige ack) |
| SnaP2P single-slot | `js/p2p.js` | `on(name)` guarda UM handler (arrays só com hub ativo) — no máximo 1 `ready`, 1 `close`, 1 `message` por página; `store.js` ocupa o `message` em páginas legadas |
| HELLO só do lado join | `play.html` | quem entrou (`?join=`) manda `{__wai:"hello"}` no `ready`; ambos anunciarem = snapshot vazio do GM apaga o log (last-wins) |
| Self-check headless | `play.html` | `location.hash === "#selftest"` rola ações locais; dump com Chrome no path completo (`"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --dump-dom`) |
| Lore como dados | `data/lore/` | Prosa em Markdown (`*.md`) + metadados em `index.json`; **árvore hierárquica** (`system→planet→geography→species→culture/tech`) via campos `id`/`parent`; personagens principais (`character`) aninham sob o `id` do planeta; naves e IAs em `tech` de Humanos; nó **`general`** agrupa `history`/`organization`; nó **`interdimensional`** para entidades entre planos; irmãos ordenados alfabeticamente; render com `marked` + `<details>`; template de geração em `prompts/lore.js` (`LorePrompts`) com `system(canon)` parametrizável; **população em lote** via `scripts/populate-lore.js` (catálogo + Gemini, idempotente, etapas `species/worlds/factions/tech`); **extração direta** via `scripts/extract-sa.js` (sourcebook S&A, descarta regras de jogo e resíduos OCR, `--force`); **imagens opcionais** em `data/lore/<tipo>/<id>.webp` (mesma pasta do `.md`, referenciadas por `image` no `index.json`; omitir o campo = sem thumbnail) |

**Padrões de prompts de IA:**
- Prompts ficam em `prompts/`, um arquivo por domínio (`planet.js`, `discovery.js`)
- Exportados via `window.NomePrompts = { system, user }` sem dependências
- Nunca embutir prompts inline em funções JS de páginas HTML
- Se o prompt referencia dados dinâmicos, usa function(params) que retorna string

**Padrões de build:**
- Nav e footer em `includes/` (`nav.html`, `footer.html`, `footer-index.html`)
- 12 páginas HTML usam `<!--#include nav-->` e `<!--#include footer-->` no source
- `npm run build` → `node build.js` resolve includes e gera `public/` (gitignored)
- `npm run deploy` → `bash deploy.sh` faz mirror de `public/`
- Nav escondido no index.html via CSS: `body:has(.entry-screen.active) .sna-nav { display: none; }`
- `docs/index.html` tem sidebar própria e NÃO usa os includes

**Rejeitados por decisão (não auditar de novo):**
- Three.js dispose: reinit raro (só page reload), impacto baixo
- Euler angles drifting: irrelevante pra sessão típica
- Regex greedy `/\{[\s\S]*\}/`: edge case improvável
- Zero testes: reavaliar quando houver build tooling
- Prompts EN/PT inconsistente: funcionam, só desperdiçam tokens — adiado
- Validação de schema do output IA: fallback local cobre falhas
- `entity.levels[]` (wai-core): zero dados/consumidores em S&A (só citado em `wai-core/docs/livro-regras-universal.md:444`) — não implementar até houver conteúdo multi-nível
