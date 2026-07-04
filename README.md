# WARP-Unit — Sistema Operacional de Exploração Interestelar

Aplicação web (HTML + CSS + JS Vanilla + PHP) para auxiliar sessões de RPG de mesa sci-fi. Quatro páginas integradas que cobrem todo o fluxo de jogo: gerenciamento de tripulação androide, painel do mestre com controle de campanha e sessão, geração procedural de missões planetárias via IA e referência das naves.

---

## Páginas

| Página | Função |
|---|---|
| **[index.html](index.html)** | Catálogo de 10 androides + ficha de personagem + rolador de dados Daggerheart. Página de entrada do sistema com tela para ingressar em campanha por código, continuar offline, ou acessar como mestre. |
| **[missioncontrol.html](missioncontrol.html)** | Painel do Mestre: campanhas (criar, arquivar), sessões (iniciar, encerrar, histórico, restaurar), recursos (medo, D20), energia de todas as unidades, PNJs, mensagens jogador↔mestre. |
| **[oneshot.html](oneshot.html)** | Gerador procedural de planetas com IA (cascade multi-provedor: Gemini → NVIDIA → Pollinations → Hermes → Local) + login do capitão (TOTP). Integração com campanha: salva planetas e descobertas na sessão ativa. |
| **[mothership.html](mothership.html)** | Descrição detalhada da nave-mãe Tiburon, veículos auxiliares e galeria. Recursos de bordo editáveis pelo mestre, modo leitura para jogadores. |
| **[400i.html](400i.html)** | Descrição da nave auxiliar Origin 400i, recursos de bordo e veículo acoplado. Mesmo modelo de permissões da Tiburon. |

---

## Tecnologias

- **HTML5** — Estrutura semântica, SPAs independentes
- **CSS3** — Tema escuro futurista centralizado em [warp.css](warp.css), custom properties, responsivo
- **JavaScript Vanilla** — Lógica de estado, renderização, persistência e chamadas à API de IA
- **PHP 8.x** — API de campanha (`api/campaign.php`), autenticação (`api/auth.php`), proxies de IA
- **localStorage + sessionStorage** — Persistência local e âncora de reconexão entre recargas
- **Gemini 3.1 Flash Lite** — Provedor premium para usuários autenticados
- **NVIDIA DeepSeek V4 Flash** — Provedor gratuito para visitantes (via build.nvidia.com)
- **JSON file storage** — Armazenamento de campanhas no servidor (`data/campaigns/`), com `flock()`

---

## Funcionalidades

### Catálogo de Unidades (`index.html`)

- **10 androides** com atributos, habilidades especiais e imagens (dados em `data/robots.json`)
- **Ficha de personagem** com stats, habilidade especial e contador de energia
- **Rolador Daggerheart**: 1d12 Esperança + 1d12 Medo + modificador vs DC + Vantagem/Desvantagem (D6)
- **Protocolo Drone**: chassi substituto ao zerar energia (configurável em `data/config.json`)
- **Entrada por código de campanha**: jogador digita código de 4 letras e conecta ao servidor
- **Campaign header**: nome da campanha + robô selecionado + botão sair
- **Mensagens**: modal para receber mensagens do mestre e enviar respostas
- **Persistência**: estado do robô e energia salvos via `WarpStore`

### Painel do Mestre (`missioncontrol.html`)

- **Campanhas**: criar, selecionar, arquivar no servidor. Código de acesso de 4 letras para jogadores.
- **Sessões**: iniciar, encerrar, anotações, planetas explorados, histórico com restauração
- **Recursos do Mestre**: pontos de Medo (0-7), rolador D20 3D
- **Unidades em Campo**: energia de todos os androides com controle granular
- **PNJs & Aliados**: 3 entradas genéricas com barras de HP
- **Mensagens**: enviar mensagens para jogadores específicos, receber respostas
- **Autenticação**: bcrypt + TOTP (Google Authenticator), cookie HMAC-SHA256
- **Accordion**: todas as seções colapsáveis para melhor navegação
- **Layout 2 colunas**: esquerda (campanha, recursos, PNJs), direita (unidades, mensagens)

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

API unificada `WarpStore` com dois backends:
- **Modo Local**: `localStorage` — para uso offline ou single-machine
- **Modo Remoto**: `fetch()` com polling 3s — para multi-dispositivo via servidor PHP

### Modelo de Dados

```
Campanha "Fronteira de KX-415"
├─ Estado atual: robots{}, npcs[], fear, mothership{}, ship400i{}
├─ pendingActions[] — alterações de energia aguardando confirmação do GM
├─ messages[] — mensagens entre GM e jogadores
└─ sessions[]
   ├─ #1: nome, data, planetas, descobertas, estado final
   └─ #2: (em andamento)
```

### API (`api/campaign.php`)

| Endpoint | Auth | Descrição |
|----------|------|-----------|
| `create` | GM | Cria campanha com código de 4 letras |
| `save` | GM | Salva estado completo |
| `load` | Código | Carrega campanha por ID + código |
| `poll` | Código | Polling leve (estado + pendências + sessões + mensagens) |
| `list` | GM | Lista campanhas não-arquivadas |
| `archive` | GM | Arquiva campanha (não deleta) |
| `delete` | GM | Remove permanentemente |
| `request` | Código | Jogador solicita alteração de energia |
| `confirm` / `reject` | GM | Aprova/recusa solicitação |
| `startsession` | GM | Inicia nova sessão de jogo |
| `endsession` | GM | Encerra sessão com snapshot |
| `saveplanet` | GM | Salva planeta + descobertas na sessão |
| `restoresession` | GM | Restaura estado de uma sessão anterior |
| `updatenotes` | GM | Salva anotações da sessão |
| `sendmessage` | GM/Código | Envia mensagem |
| `dismissmessage` | GM/Código | Remove mensagem |

---

## Estrutura do Projeto

```
WARP-Unit/
├── index.html              Catálogo de unidades + ficha + dados + entrada
├── missioncontrol.html     Painel do mestre (campanha, sessão, recursos, mensagens)
├── oneshot.html            Gerador de missão one-shot (auth + IA cascade + sessão)
├── mothership.html         Nave-mãe Tiburon
├── 400i.html               Nave auxiliar Origin 400i
├── equipamento.html        Catálogo de equipamentos
├── warp.css                CSS centralizado (tema + componentes)
├── .env                    Credenciais locais (não commitado)
├── .env.example            Template do .env
├── .htaccess               Protege .env e data/campaigns/
├── js/
│   └── store.js            WarpStore — estado compartilhado (local + remoto)
├── api/
│   ├── auth.php            Login bcrypt + TOTP, cookie HMAC-SHA256
│   ├── campaign.php        CRUD de campanha, sessão, mensagens, polling
│   ├── join.php            Busca campanha por código (HTML + JSON)
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
│   ├── enemies.json        Inimigos do universo
│   └── campaigns/          JSON files de campanhas (gerados pelo servidor)
├── img/                    Imagens dos androides, naves, logo, background
├── docs/                   Documentação detalhada
└── plans/                  Planos de implementação
    └── campaign-control.md Plano de controle de campanha e sessão
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
| `warp-unit-state` | localStorage | Estado unificado (robôs, recursos, medo, campanha ativa) |
| `warp-session` | sessionStorage | Âncora de reconexão (campaignId, code, mode) — sobrevive reload |
| `warp-unit-oneshot` | localStorage | Estado da missão one-shot (planeta, descobertas) |
| `data/campaigns/*.json` | Servidor | Estado completo das campanhas (multi-dispositivo) |

---

## Como Executar

1. Clone o repositório
2. Copie `.env.example` para `.env` e configure as credenciais
3. Sirva com PHP embutido ou Apache:
   ```bash
   php -S localhost:8000
   ```
4. Acesse `http://localhost:8000`

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
