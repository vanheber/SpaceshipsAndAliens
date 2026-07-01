# Sistema de Energia

Cada unidade opera com **Células de Energia** que representam sua autonomia em campo. A energia funciona como recurso tático e indicador de desgaste.

## Capacidade

Toda unidade possui dois valores:

| Campo | Significado |
|---|---|
| `startingEnergy` | Energia com que a unidade **inicia a missão** |
| `maxEnergy` | **Teto máximo** que a unidade pode acumular (2x o inicial) |

Exemplo: Regis V4 — começa com 6 células, pode acumular até 12.

## Gastando e Recuperando

| Ação | Efeito |
|---|---|
| **Gastar Energia (-1)** | Consome 1 célula (ativa manualmente ou por eventos narrativos) |
| **Adicionar Energia (+1)** | Recupera 1 célula (via rolagens bem-sucedidas ou habilidades) |
| **Crítico ou Esperança** | +1 célula automaticamente após rolagem |
| **Medo** | Sem recuperação — a tensão se acumula |

## Energia Zero

Quando a energia de uma unidade ativa chega a **zero**:

1. A unidade é desativada
2. Um alerta informa o operador
3. O sistema ativa automaticamente o **Protocolo Drone**

## Protocolo Drone (Modo de Emergência)

Ao perder a unidade principal, um chassi substituto limitado assume o controle:

| Atributo | Valor |
|---|---|
| Nome | Drone Limitado (M-1) |
| CA | 10 |
| Ataque | +0 |
| Inteligência | +0 |
| Energia | 3/6 |
| Habilidade | Nenhuma |

O operador pode alternar entre o drone e a unidade principal a qualquer momento pelo botão de protocolo. Ao retornar, a unidade principal recupera sua energia inicial.
