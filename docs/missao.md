# Controle da Missão — Painel do Mestre

O **Controle da Missão** (`missioncontrol.html`) é o painel do operador para gerenciar recursos narrativos e rastrear energia de todas as unidades em campo simultaneamente.

## Acesso

Acessível pelo footer de qualquer página ou diretamente pela URL `missioncontrol.html`.

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

Um dado de 20 faces (branco com números pretos) para rolagens livres do mestre. Renderizado em 3D com Three.js, animação de quaternion igual aos D12/D6. Os números 6 e 9 recebem underline para evitar confusão de orientação — convenção padrão de dados de RPG. O visor ocupa 220px de altura.

### Unidades em Campo

Lista todos os androides disponíveis no catálogo (`data/robots.json`), cada um com seu próprio bloco de energia.

| Propriedade | Descrição |
|---|---|
| Células | Energia atual da unidade |
| Máximo | Valor `maxEnergy` do robô |
| Inicial | Valor `startingEnergy` do robô |

**Ações**: Clique em uma célula para definir o nível. Botões Gastar (-1), Adicionar (+1) e Recarregar (restaura ao inicial).

### PNJs & Aliados

Três entradas genéricas para controle de personagens não-jogadores ou aliados temporários.

| Propriedade | Valor |
|---|---|
| Nomes | PNJ 1 · PNJ 2 · PNJ 3 |
| Máximo | 20 células |
| Inicial | 5 células |
| Cor | Vermelha (`--accent-fear`) |

## Persistência

O estado completo (medo, energia de cada robô e PNJs) é salvo no `localStorage` com a chave `warp-unit-mission`.

**Limpar dados**: Clique em "Limpar Missão" no footer para reiniciar todos os valores.

## Dependências

| Recurso | Origem |
|---|---|
| `data/robots.json` | Lista de unidades disponíveis |
| `warp.css` | Estilos base (classes `.energy-section`, `.token-row`, `.energy-token`) |
| `localStorage` | Persistência de estado |

## Visual

O layout segue a mesma identidade visual do sistema: fundo escuro, cards com borda sutil, células de energia como círculos preenchidos/vazios, e botões de ação no estilo "roll-btn".
