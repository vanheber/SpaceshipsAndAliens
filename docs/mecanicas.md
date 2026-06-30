# Mecânica de Rolagem (Daggerheart)

O sistema utiliza dois dados de 12 faces que representam forças opostas no campo de batalha.

## Dados

| Dado | Cor | Significado |
|---|---|---|
| **Esperança (Hope)** | Azul | Forças favoráveis, instintos, aliados |
| **Medo (Fear)** | Vermelho | Ameaças, complicações, ambiente hostil |

## Fórmula

```
Resultado = 1d12 (Hope) + 1d12 (Fear) + Modificador
```

O resultado é comparado contra a **Classe de Dificuldade (DC)** definida pelo operador.

## Regras de Desfecho

### Crítico (Hope = Fear)
Os dados empatam. Sucesso ou falha vem acompanhado de uma **grande vantagem tática**. O destino se manifesta de forma intensa.
- **Efeito**: +1 Célula de Energia

### Sucesso com Esperança (Hope > Fear)
A ação é bem-sucedida e ainda gera um **benefício colateral** para a unidade ou esquadrão.
- **Efeito**: +1 Célula de Energia

### Falha com Esperança (Hope > Fear)
A ação falha, mas a unidade encontra uma **abertura inesperada** ou recurso extra.
- **Efeito**: +1 Célula de Energia

### Sucesso com Medo (Hope < Fear)
A ação é bem-sucedida, porém gera uma **complicação** no cenário.
- **Efeito**: Nenhum bônus de energia

### Falha com Medo (Hope < Fear)
A ação falha e a situação se agrava com uma **ameaça crescente**.
- **Efeito**: Nenhum bônus de energia

## Modificadores

Antes de cada rolagem, o operador seleciona qual modificador aplicar:

| Modificador | Uso Típico |
|---|---|
| **Ataque** | Combate direto, disparos, investidas |
| **Inteligência** | Análise, hacking, investigação |
| **Especialidade** | Uso da habilidade única da unidade |
| **Nenhum (+0)** | Ações genéricas ou modo Drone |

## Vantagem / Desvantagem (D6)

Ações que merecem bônus ou penalidade usam um dado extra de 6 faces:

| Modo | Efeito |
|---|---|
| **Com Vantagem** | `+1d6` na soma total. Dado amarelo (roxo) exibido no visor 3D. |
| **Com Desvantagem** | `-1d6` na soma total. Dado roxo (amarelo) exibido no visor 3D. |

Os D6 não interferem na determinação de Esperança/Medo — apenas os D12 decidem isso.
As rolagens com Vantagem/Desvantagem mantêm seus dados visíveis no visor 3D até a próxima jogada.
