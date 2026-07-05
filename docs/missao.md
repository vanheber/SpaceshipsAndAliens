# Controle da Missão — Painel do Mestre

O **Controle da Missão** (`missioncontrol.html`) é o painel do operador para gerenciar campanhas, recursos narrativos e rastrear energia de todas as unidades em campo simultaneamente.

## Acesso

Pelo menu de navegação de qualquer página ou diretamente pela URL `missioncontrol.html`.

## Campanhas (Armazenamento Local)

Campanhas são armazenadas no `localStorage` sob a chave `warp-campaigns`. Cada campanha contém:

| Campo | Descrição |
|---|---|
| `id` | Identificador único (`c` + timestamp base36) |
| `name` | Nome da campanha |
| `state` | Snapshot completo do `WarpStore` (robôs, PNJs, medo, naves) |
| `archived` | `true` se arquivada, `false` se ativa |
| `createdAt` | Data de criação ISO |

### Gerenciamento

- **Criar**: Selecione "+ Criar nova campanha..." no menu suspenso
- **Salvar**: O estado é salvo automaticamente ao alternar campanhas
- **Arquivar**: Botão "Arquivar campanha" → move para o arquivo morto
- **Restaurar/Excluir**: Página `arquivadas.html` (link no menu de navegação)
- **Exportar/Importar**: Botões para download/upload de campanhas como JSON

### Limite de Arquivadas

Mantém-se no máximo **10 campanhas arquivadas**. Ao arquivar uma nova, as mais antigas são removidas automaticamente.

### Leitura sobre persistência

O `WarpStore` opera em modo `"local"` (apenas `localStorage`, sem servidor). Em sessões P2P, o `_saveLocal()` também persiste o estado, garantindo que reloads não percam dados.

## Seções

### Pontos de Medo (GM)

Recurso do mestre para ativar eventos adversos, complicações ou ameaças durante a missão.

| Propriedade | Valor |
|---|---|
| Máximo | 7 células |
| Inicial | 0 |
| Cor | Roxa (`--accent-hope`) |

**Uso**: Clique em uma célula para definir o nível exato. Use os botões +/- para incrementar/decrementar.

### D20 — Rolagem Livre

Um dado de 20 faces (branco com números pretos) para rolagens livres do mestre. Renderizado em 3D com Three.js, animação de quaternion igual aos D12/D6. Os números 6 e 9 recebem underline para evitar confusão de orientação. O visor ocupa 220px de altura.

### Unidades em Campo

Lista todos os androides do catálogo (`data/robots.json`), cada um com seu bloco de energia.

| Propriedade | Descrição |
|---|---|
| Células | Energia atual da unidade |
| Máximo | `maxEnergy` do robô |
| Inicial | `startingEnergy` do robô |

**Ações**: Clique em uma célula para definir o nível. Botões Gastar (-1), Adicionar (+1) e Recarregar.

### PNJs & Aliados

Três entradas genéricas para personagens não-jogadores ou aliados temporários.

| Propriedade | Valor |
|---|---|
| Nomes | PNJ 1 · PNJ 2 · PNJ 3 |
| Máximo | 20 células |
| Inicial | 5 células |
| Cor | Vermelha (`--accent-fear`) |

### Recursos das Naves

Painel esquerdo com duas seções expansíveis:

- **Nave-Mãe Tiburon**: Suprimentos (20), Combustível (10), Munição (10), Blindagem/Escudo (20)
- **Origin 400i**: Suprimentos (8), Combustível (6), Munição (4), Blindagem/Escudo (8)

Os dados vêm do `WarpStore` (`mothership` / `ship400i`). As páginas individuais das naves (`mothership.html`, `400i.html`) são apenas consultivas — a edição é centralizada aqui.

## Sessões

Uma sessão representa uma jogada ou missão dentro da campanha. Ao iniciar, um snapshot do estado atual é salvo. Ao encerrar, notas podem ser adicionadas. Sessões anteriores podem ser restauradas.

- **Iniciar Sessão**: Salva o estado atual como `startState`
- **Planeta Pendente**: Se um planeta foi gerado no `oneshot.html` com "Salvar na Sessão", aparece um banner para adicioná-lo à sessão ativa
- **Encerrar**: Salva notas e `endState`
- **Restaurar**: Botão "▶ Continuar" na sessão anterior — restaura `endState` como estado atual

## P2P Serverless (Jogador Remoto)

Sistema peer-to-peer via WebRTC sem servidor intermediário.

### Fluxo

1. GM clica "Nova Sala" → gera oferta SDP comprimida → exibe link + QR code
2. Jogador abre o link (ou escaneia QR) → campainha via `index.html?join=...`
3. GM cola a resposta do jogador e clica "Conectar"
4. Conexão estabelecida → dados de energia, mensagens e rolagens fluem em tempo real

### Hub de Persistência

Para evitar desconexão ao recarregar a página, o sistema abre um popup dedicado (`p2p-hub.html`) que segura a conexão WebRTC. As páginas principais se comunicam com o hub via `BroadcastChannel("warp-p2p")`.

- `WarpP2P.hubConnect()` é chamado no clique do GM/jogador (gesto de usuário)
- Se o popup for bloqueado, o sistema cai no modo direto (sem hub)
- O hub não tem UI — apenas um popup de 350×250px

### Jogador

- Energia: em modo P2P com papel `"player"`, os botões `+1`/`-1` são ocultos — o jogador só vê o valor atual
- Rolagem de dados: ao rolar, envia `{type:"diceResult", hope, fear, total, dc, robotId}` para o GM
- Mensagens: pode enviar/receber mensagens do GM via P2P

### GM

- Recebe `diceResult` e cria uma ação pendente com detalhes dos dados
- Painel de jogadores mostra status online/offline com indicadores verde/vermelho

## Ações Pendentes

Um banner exibe ações solicitadas por jogadores (via P2P) ou geradas por rolagens (diceResult). Cada ação mostra:

- Descrição do tipo (ex: `Esperança N | Medo N · total vs DC N`)
- Botão **✓** (confirmar) — aplica +1 energia
- Botão **✗** (rejeitar) — descarta sem aplicar

## Mensagens (Inbox)

GM pode receber mensagens de jogadores via P2P. A inbox exibe remetente e texto, com botão "✕" para dismiss.

## Logs de Rolagem

Um log no canto inferior exibe o histórico de rolagens da sessão, incluindo dados lançados, modificadores e resultados.

## Visual

Layout em grid com painel esquerdo (recursos das naves + sessão), painel central (robôs + PNJs), e painel direito (medo + D20 + log). Fundo escuro, cards com borda sutil, células de energia como círculos preenchidos/vazios.

Ícones via Bootstrap Icons (outlined) carregados de CDN.
