# WARP-Unit — Sistema Operacional de Exploração Interestelar

Aplicação web (HTML + CSS + JS Vanilla) para auxiliar sessões de RPG de mesa sci-fi. Seis páginas integradas que cobrem todo o fluxo de jogo: gerenciamento de tripulação androide, painel do mestre com controle de campanha e sessão, geração procedural de missões planetárias via IA e referência das naves.

---

## Páginas

| Página | Função |
|---|---|
| **[index.html](index.html)** | Catálogo de 10 androides + ficha de personagem + rolador de dados Daggerheart. Página de entrada do sistema com tela para conectar por QR/link P2P, modo leitura do catálogo, mensagens do mestre. |
| **[missioncontrol.html](missioncontrol.html)** | Painel do Mestre: campanhas (criar, arquivar, exportar/importar), sessões (iniciar, encerrar, histórico, restaurar), recursos (medo, D20), energia de todas as unidades, PNJs, mensagens jogador↔mestre, recursos das naves. |
| **[oneshot.html](oneshot.html)** | Gerador procedural de planetas com IA (cascade multi-provedor: Gemini → NVIDIA → Pollinations → Hermes → Local). Integração com campanha: salva planetas e descobertas na sessão ativa. |
| **[mothership.html](mothership.html)** | Descrição detalhada da nave-mãe Tiburon, veículos auxiliares e galeria. Modo consultivo — recursos editáveis apenas no Controle da Missão. |
| **[400i.html](400i.html)** | Descrição da nave auxiliar Origin 400i, veículo acoplado e galeria. Modo consultivo. |
| **[arquivadas.html](arquivadas.html)** | Gerencia campanhas arquivadas: restaurar ou excluir permanentemente. |

---

## Tecnologias

- **HTML5** — Estrutura semântica, SPAs independentes
- **CSS3** — Tema escuro futurista centralizado em [warp.css](warp.css), custom properties, responsivo
- **JavaScript Vanilla** — Lógica de estado, renderização, persistência e chamadas à API de IA
- **WebRTC** — P2P serverless entre GM e jogadores via `RTCPeerConnection` + `RTCDataChannel`
- **BroadcastChannel** — Persistência de conexão P2P entre reloads (hub popup)
- **localStorage + sessionStorage** — Persistência de campanhas, estado e âncora de reconexão
- **PHP 8.x** — Proxies de IA (`api/proxy.php`, `api/proxy-nvidia.php`)
- **Bootstrap Icons** — Ícones outlined via CDN
- **Gemini 3.1 Flash Lite** — Provedor premium para usuários autenticados
- **NVIDIA DeepSeek V4 Flash** — Provedor gratuito para visitantes

---

## Funcionalidades

### Catálogo de Unidades (`index.html`)

- **10 androides** com atributos, habilidades especiais e imagens (dados em `data/robots.json`)
- **Ficha de personagem** com stats, habilidade especial e contador de energia
- **Rolador Daggerheart**: 1d12 Esperança + 1d12 Medo + modificador vs DC + Vantagem/Desvantagem (D6)
- **Protocolo Drone**: chassi substituto ao zerar energia (configurável em `data/config.json`)
- **Entrada P2P**: jogador conecta via link/QR code gerado pelo GM — sem servidor
- **Modo Leitura**: `?readonly=1` exibe o catálogo sem ficha de personagem
- **Campaign header**: nome da campanha + robô selecionado + botão sair
- **Rolagem remota**: resultados de dados enviados ao GM via P2P (diceResult)
- **Mensagens**: modal para receber mensagens do mestre e enviar respostas via P2P
- **Persistência**: estado do robô e energia salvos via `WarpStore` (localStorage)

### Painel do Mestre (`missioncontrol.html`)

- **Campanhas**: criar, salvar, alternar, exportar/importar JSON, arquivar (limite 10 arquivadas)
- **Sessões**: iniciar, encerrar, anotações, planetas explorados, histórico com restauração
- **Recursos das Naves**: Tiburon + 400i (suprimentos, combustível, munição, blindagem) — edição centralizada
- **Recursos do Mestre**: pontos de Medo (0-7), rolador D20 3D
- **Unidades em Campo**: energia de todos os androides com controle granular
- **PNJs & Aliados**: 3 entradas genéricas com barras de HP
- **P2P Serverless**: GM gera sala → jogador conecta por link/QR → dados, mensagens e rolagem em tempo real
- **Hub de Persistência**: popup (`p2p-hub.html`) segura WebRTC enquanto a página recarrega
- **Ações Pendentes**: solicitações de energia e resultados de rolagem com confirmação/rejeição
- **Mensagens (Inbox)**: enviar/receber mensagens de jogadores conectados via P2P
- **Arquivamento**: `arquivadas.html` — restaurar ou excluir campanhas arquivadas

### Gerador de Missão (`oneshot.html`)

- **Geração de planetas**: 12 tipos, nomes código XX-999a, descrições atmosféricas
- **Expedição passo a passo**: abordagem + descoberta + perigo (DC) + recompensa
- **Cascade multi-provedor**: Gemini (auth) → NVIDIA (grátis) → Pollinations → Hermes → Local
- **Autenticação do capitão**: bcrypt + TOTP (Google Authenticator), cookie HMAC-SHA256
- **Contexto narrativo**: últimos 3 eventos completos enviados no prompt para continuidade
- **Contexto de campanha**: estado dos robôs e recursos injetados nos prompts quando em modo remoto
- **Integração com sessão**: botão "Salvar na Sessão" envia planeta + descobertas para a campanha ativa
- **Diário de bordo**: registro completo das descobertas ao final
- **Exportação**: botão "Exportar .md" para uso com IA de conto (`PROMPT_CONTO.md`)

### Naves (`mothership.html` / `400i.html`)

- **Aegis Tiburon**: visão geral, especificações, layout do convés, IA Capitã, P-72, Ursa Rover, galeria
- **Origin 400i**: pathfinder de luxo, Mirai Pulse, galeria
- **Recursos de bordo**: suprimentos, combustível, munição, blindagem/escudo. Editáveis pelo mestre, modo leitura para jogadores.
- **Galeria com lightbox**: navegação touch/keyboard

---

## Arquitetura de Campanha & Sessão

### Estado Compartilhado (`js/store.js`)

`WarpStore` opera em modo **local** (`localStorage`) com suporte a sessão P2P via `js/p2p.js` + `js/p2p-hub.js`.

### Modelo de Dados

```
localStorage["warp-campaigns"] = [
  { id, name, archived, createdAt, state: { robots, npcs, fear, mothership, ship400i,
    pendingActions[], messages[], sessions[] } }
]
```

### Conexão P2P

```
GM (missioncontrol) ←→ Hub (p2p-hub.html, popup) ←WebRTC→ Jogador (index.html)
```

O hub sobrevive a reloads via BroadcastChannel. Sem servidor intermediário — conexão direta entre os peers.

---

## Estrutura do Projeto

```
WARP-Unit/
├── index.html              Catálogo de unidades + ficha + entrada P2P
├── missioncontrol.html     Painel do mestre (campanhas, sessões, P2P, recursos)
├── oneshot.html            Gerador de missão one-shot (IA cascade + sessão)
├── mothership.html         Nave-mãe Tiburon (consultivo)
├── 400i.html               Nave auxiliar Origin 400i (consultivo)
├── equipamento.html        Catálogo de equipamentos
├── arquivadas.html         Gerencia campanhas arquivadas
├── p2p-hub.html            Popup hub que segura WebRTC entre reloads
├── warp.css                CSS centralizado (tema + componentes)
├── sw.js                   Service Worker (network-first navegações)
├── .htaccess               Cache-Control + proteção de arquivos
├── js/
│   ├── store.js            WarpStore — estado compartilhado (localStorage)
│   ├── p2p.js              Núcleo WebRTC (RTCPeerConnection + DataChannel)
│   └── p2p-hub.js          Proxy BroadcastChannel para o hub
├── api/
│   ├── proxy.php           Proxy Gemini (requer cookie de auth)
│   ├── proxy-nvidia.php    Proxy NVIDIA DeepSeek V4 Flash (público)
│   ├── load-env.php        .env loader compartilhado
│   └── rate-limit.php      Rate limit file-based
├── data/
│   ├── robots.json         Catálogo de 10 androides
│   ├── config.json         Configuração do drone de backup
│   ├── planet-types.json   12 tipos de planeta
│   ├── planet-params.json  Parâmetros para geração procedural
│   ├── planet-names.json   Prefixos/códigos para nome de planeta
│   ├── discoveries.json    Pools de descoberta (fallback)
│   ├── events-params.json  Parâmetros de eventos
│   ├── events-categories.json Categorias de eventos
│   └── enemies.json        Inimigos do universo
├── img/                    Imagens dos androides, naves, logo, background
├── docs/                   Documentação detalhada
└── plans/                  Planos de implementação
```

---

## Sistema de Rolagem (Daggerheart)

| Dado | Cor | Significado |
|---|---|---|
| Esperança (Hope) | Dourado | Forças favoráveis, instintos, aliados |
| Medo (Fear) | Roxo | Ameaças, complicações, ambiente hostil |
| Vantagem (D6) | Dourado | Bônus tático (+1d6) |
| Desvantagem (D6) | Roxo | Penalidade (-1d6) |

**Fórmula**: `1d12 (Hope) + 1d12 (Fear) + Modificador ± D6` vs `DC`

| Resultado | Efeito |
|---|---|
| **Crítico** (Hope = Fear) | +1 Energia |
| **Esperança** (Hope > Fear) | +1 Energia, benefício colateral |
| **Medo** (Hope < Fear) | Sem bônus, complicação no cenário |

---

## Persistência

| Chave | Tipo | Conteúdo |
|---|---|---|
| `warp-campaigns` | localStorage | Array de campanhas (nome, estado, sessões, arquivadas) |
| `warp-unit-state` | localStorage | Estado unificado (robôs, recursos, medo) |
| `warp-session` | sessionStorage | Âncora de reconexão (campaignId, mode, P2P role) |
| `warp-unit-oneshot` | localStorage | Estado da missão one-shot (planeta, descobertas) |

---

## Como Executar

1. Clone o repositório
2. Sirva com qualquer servidor HTTP estático:
   ```bash
   npx serve .
   # ou: python3 -m http.server 8000
   # ou: php -S localhost:8000  (para proxies de IA)
   ```
3. Acesse `http://localhost:8000`

> Para usar geração por IA, é necessário PHP com os proxies em `api/`.

## Deploy

`deploy.sh` envia via FTP para o servidor de produção. SSL verify desabilitado (`set ssl:verify-certificate no`).

---

## Personalização

Todos os dados são carregados de arquivos JSON externos:

- **Androides**: edite `data/robots.json`
- **Drone**: edite `data/config.json`
- **Planetas**: edite `data/planet-types.json`, `data/planet-params.json`
- **Descobertas**: edite `data/discoveries.json`, `data/events-params.json`, `data/events-categories.json`
- **Inimigos**: edite `data/enemies.json`
- **CSS**: edite variáveis em `:root` no `warp.css`

Schemas detalhados em [`docs/schema.md`](docs/schema.md).
