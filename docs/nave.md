# Nave-Mãe Tiburon

A **Aegis Tiburon** é a nave-mãe da missão WARP — o corpo físico da IA Capitã A.L.M.A. e o lar da tripulação androide entre as missões.

## Visão Geral

| Atributo | Valor |
|---|---|
| Fabricante | Aegis Dynamics |
| Modelo | Tiburon (variante WARP) |
| Função Original | Canhoneira Pesada Anticapital |
| Função WARP | Nave-Mãe de Exploração |
| Comprimento | 121 m |
| Tripulação | 1 IA Capitã + até 8 androides |

## Recursos de Bordo

A nave possui três pools de recursos narrativos gerenciáveis pelo operador, todos persistidos em `localStorage` (chave `warp-unit-mothership`):

| Recurso | Máximo | Inicial | Cor | Uso |
|---|---|---|---|---|---|
| **Suprimentos** | 20 | 10 | Verde | Reparos, equipamentos, cura |
| **Combustível** | 10 | 10 | Roxo | Saltos interplanetários, geradores, rover |
| **Munição** | 10 | 10 | Vermelho | Armas da nave e defesa |
| **Blindagem/Escudo** | 20 | 20 | Azul/Verde | Resistência física (10) + barreira energética (10) |

**Operação**: Clique em uma célula para definir o nível exato. Use os botões Consumir/Abastecer para incrementar/decrementar. O botão Recarregar restaura o valor inicial.

**Limpar dados**: link "Limpar Recursos" no footer.

## Layout do Convés

A Tiburon possui um único convés contínuo de 121 metros, organizado da popa à proa:

1. **Baía de Carga** — Rampa retrátil, 20 unidades de carga, acomoda o Ursa Rover
2. **Corredor de Engenharia** — Planta de força, resfriadores, propulsor de dobra, 8 cápsulas de escape
3. **Docks Ventrais** — 2× P-72 Archimedes acoplados magneticamente
4. **Alojamentos da Tripulação** — 8 beliches com recarga por indução
5. **Quartos do Capitão** — Núcleo A.L.M.A., consoles de comando
6. **Refeitório e Cozinha** — Espaço comum com estação de manutenção
7. **Arsenal** — Antiga câmara de acoplamento convertida
8. **Ponte de Comando** — Controles de navegação e comunicações

## Sistemas Defensivos

| Sistema | Armamento | Tipo |
|---|---|---|
| Arma Primária | Supremacy-10T | Laser de Proa — Dano Concentrado |
| Torres Laterais | 4× C-07T | Canhões Balísticos — Torres Remotas |
| Torre de Popa | 4× CF-447 | Repetidores Laser — Tripulada |
| Mísseis | 32× S3 | Mísseis Teleguiados Antinave |
| Escolta | 2× P-72 Archimedes | Caças Leves — Dock Ventral |
| Blindagem | Reforçada | Placas Compostas |

## Veículos Acoplados

### P-72 Archimedes (2 unidades)
Mini-caça de escolta da Kruger Intergalactic. 12 m de comprimento, velocidade máxima 1.550 m/s, armado com 4× S1. Acoplamento magnético ventral.

### Ursa Rover (1 unidade)
Veículo de exploração terrestre RSI. 7.6 m, tripulação 2 + 4 passageiros, torre laser S1, carga de 4 unidades. Acomodado na baía de carga.

---

# Nave Auxiliar — Origin 400i

A **Origin 400i** é uma pathfinder de luxo que serve como nave auxiliar da missão WARP. Projetada para reconhecimento de longo alcance, oferece agilidade e conforto para exploração planetária.

## Visão Geral

| Atributo | Valor |
|---|---|
| Fabricante | Origin Jumpworks |
| Modelo | 400i |
| Função | Pathfinder de Luxo / Nave Auxiliar |
| Comprimento | 56 m |
| Tripulação | 1 a 3 |

## Recursos de Bordo

Recursos narrativos gerenciáveis pelo operador, persistidos em `localStorage` (chave `warp-unit-400i`):

| Recurso | Máximo | Inicial | Cor | Uso |
|---|---|---|---|---|
| **Suprimentos** | 8 | 4 | Verde | Equipamentos e manutenção |
| **Combustível** | 6 | 6 | Roxo | Deslocamentos e exploração |
| **Munição** | 4 | 4 | Vermelho | Armas de bordo |
| **Blindagem/Escudo** | 8 | 8 | Azul/Verde | Resistência física (3) + barreira energética (5) |

## Sistemas Defensivos

| Sistema | Armamento | Tipo |
|---|---|---|
| Arma Primária | 2× S4 Rhino Repeater | Laser de Proa |
| Torres Remotas | 2× S4 (2× S3 Panther cada) | Torres Traseiras |
| Mísseis | 16× S2 + 16× S1 | Mísseis Teleguiados |
| Escudo | S3 | Gerador Reforçado |

## Veículo Acoplado

### Mirai Pulse
Grav-cycle compacto da Mirai para reconhecimento de superfície. 3.15 m, 1 tripulante, armado com 1× S2 Laser Repeater, velocidade máxima 561 m/s. Acondicionado na baia dianteira da 400i.
