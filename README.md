# WARP-Unit — Sistema Operacional de Exploração Interstelar

Aplicação web estática (HTML + CSS + JS Vanilla) para auxiliar sessões de RPG de mesa sci-fi. Três páginas integradas que cobrem todo o fluxo de jogo: gerenciamento de tripulação androide, geração procedural de missões planetárias e referência da nave-mãe.

---

## Páginas

| Página | Função |
|---|---|
| **[index.html](index.html)** | Catálogo de 10 androides + ficha de personagem + rolador de dados Daggerheart |
| **[oneshot.html](oneshot.html)** | Gerador procedural de planetas com IA (Pollinations) + fallback em pools locais |
| **[mothership.html](mothership.html)** | Descrição detalhada da nave-mãe Tiburon, veículos auxiliares e galeria |

---

## Tecnologias

- **HTML5** — Estrutura semântica, 3 SPAs independentes
- **CSS3** — Tema escuro futurista centralizado em [warp.css](warp.css), custom properties, responsivo
- **JavaScript Vanilla** — Lógica de estado, renderização, persistência e chamadas à API de IA
- **localStorage** — Persistência de estado entre sessões em todas as páginas
- **Pollinations.ai** — Geração procedural de planetas e descobertas via IA (gratuito, sem auth)

---

## Funcionalidades

### Catálogo de Unidades (`index.html`)

- **10 androides** com atributos, habilidades especiais e imagens (dados em `data/robots.json`)
- **Ficha de personagem** com stats, habilidade especial e contador de energia
- **Rolador Daggerheart**: 1d12 Esperança + 1d12 Medo + modificador vs DC
- **Protocolo Drone**: chassi substituto ao zerar energia (configurável em `data/config.json`)
- **Persistência**: estado do robô e energia salvos em localStorage

### Gerador de Missão (`oneshot.html`)

- **Geração de planetas**: 12 tipos, nomes código XX-999a, descrições atmosféricas
- **Expedição passo a passo**: abordagem + descoberta + perigo (DC) + recompensa
- **IA integrada**: tenta Pollinations.ai primeiro, fallback silencioso para pools locais
- **Diário de bordo**: registro completo das descobertas ao final
- **Persistência**: missão inteira salva em localStorage (planeta, descobertas, progresso)
- **Dados externos**: `planet-types.json`, `planet-names.json`, `discoveries.json`

### Nave-Mãe (`mothership.html`)

- **Aegis Tiburon**: visão geral, especificações, layout do convés (popa→proa, 8 seções)
- **IA Capitã A.L.M.A.**: descrição da integração IA-nave
- **P-72 Archimedes**: mini-caças de escolta com dock ventral
- **Ursa Rover**: veículo de exploração de superfície
- **Sistemas defensivos**: armamento e blindagem
- **Galeria com lightbox**: 10 imagens com navegação touch/keyboard

---

## Estrutura do Projeto

```
WARP-Unit/
├── index.html              Catálogo de unidades + ficha + dados
├── oneshot.html            Gerador de missão one-shot
├── mothership.html         Nave-mãe Tiburon
├── warp.css                CSS centralizado (tema + componentes)
├── deploy.sh               Script de deploy via lftp
├── data/
│   ├── robots.json         Catálogo de 10 androides
│   ├── config.json         Configuração do drone de backup
│   ├── planet-types.json   12 tipos de planeta
│   ├── planet-names.json   Prefixos/códigos para nome de planeta
│   └── discoveries.json    Pools: categorias, locais, perigos, recompensas
├── img/                    Imagens dos androides, Tiburon, P-72, Ursa
├── docs/                   Documentação detalhada
└── README.md
```

---

## Sistema de Rolagem (Daggerheart)

| Dado | Cor | Significado |
|---|---|---|
| Esperança (Hope) | Azul | Forças favoráveis, instintos, aliados |
| Medo (Fear) | Vermelho | Ameaças, complicações, ambiente hostil |

**Fórmula**: `1d12 (Hope) + 1d12 (Fear) + Modificador` vs `DC`

| Resultado | Efeito |
|---|---|
| **Crítico** (Hope = Fear) | +1 Energia |
| **Esperança** (Hope > Fear) | +1 Energia, benefício colateral |
| **Medo** (Hope < Fear) | Sem bônus, complicação no cenário |

---

## Persistência

Todas as páginas salvam estado em **localStorage** com chaves independentes:

| Página | Chave | Conteúdo |
|---|---|---|
| `index.html` | `warp-unit-catalog` | Robô ativo, energia, modo drone |
| `oneshot.html` | `warp-unit-oneshot` | Planeta, descobertas, progresso, página atual |

Botão "Limpar Sessão" / "Limpar Missão" em cada página remove os dados.

---

## Como Executar

Aplicação estática, sem dependências:

1. Clone o repositório
2. Abra qualquer `.html` no navegador, ou:
   ```bash
   npx serve .
   ```

---

## Personalização

Todos os dados são carregados de arquivos JSON externos. Para criar seu próprio tema:

- **Androides**: edite `data/robots.json`
- **Drone**: edite `data/config.json`
- **Planetas**: edite `data/planet-types.json`
- **Descobertas**: edite `data/discoveries.json` (categorias, perigos, recompensas)
- **CSS**: edite variáveis em `:root` no `warp.css`

Schemas detalhados em [`docs/schema.md`](docs/schema.md).
