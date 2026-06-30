# WARP-Unit: estilo lazydir

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

**WARP-Unit specífico:** os dados 3D com Three.js e os prompts de IA são o charme do projeto — não reduzir. Estilo visual (CSS, badges, banners) também não — o jogo precisa de atmosfera.

# Regras de melhoria (improve)

**Workflow:** auditar → planejar em `plans/` → executar via subagente separado.
- A auditoria (**/improve**) é modo *read-only*. Nunca edita código — só investiga e produz planos.
- Planos são auto-contidos: paths exatos, excerpts do estado atual, passos ordenados, comandos de verificação, critérios de done.
- Execução é delegada a subagente barato (Gemma 4). O agente principal revisa o diff e dá o veredito.
- Depois de executar, **fecha o loop**: atualiza AGENTS.md com os novos padrões descobertos.

**Padrões descobertos nas execuções anteriores:**

| Padrão | Onde | Regra |
|--------|------|-------|
| CORS com credenciais | `api/auth.php`, `api/proxy.php` | Reflection com allowlist, nunca `*` quando `Credentials: true` |
| Compartilhamento PHP | `api/load-env.php` | `.env` loader extraído pra `require_once`; sem copy-paste |
| Cookie de auth | `api/auth.php` | Sempre `httponly: true` + `secure: true` + `samesite: Lax` |
| DOM handlers pendurados | `oneshot.html` | `innerHTML = ""` no container pra matar listeners antes de esconder/seção |
| Catch vazio | `oneshot.html` | Nunca `catch (e) {}` sem diagnóstico — no mínimo `console.warn` |
| Guarda de estado global | `oneshot.html` | `if (!planet) return;` no topo de funções que acessam estado sem dono claro |
| Verificação PHP | Todos | `php -l` depois de qualquer edição em `.php` |

| Sanitização de IA | `oneshot.html` | `esc()` helper HTML-escape antes de innerHTML com conteúdo gerado por IA |
| Prompt injection | `oneshot.html` | Dados gerados por IA no prompt seguinte delimitados com `[DATA]...[/DATA]` |
| Rate limit PHP | `api/rate-limit.php` | Arquivo-based, sem dependências; `ponytail:` nomeia ceiling de race condition |

**Rejeitados por decisão (não auditar de novo):**
- Three.js dispose: reinit raro (só page reload), impacto baixo
- Euler angles drifting: irrelevante pra sessão típica
- Regex greedy `/\{[\s\S]*\}/`: edge case improvável
- Zero testes: reavaliar quando houver build tooling
- NVIDIA proxy público: intencional (gratuito pra visitantes)
- CSRF no auth: coberto por `SameSite: Lax` no cookie
- Prompts EN/PT inconsistente: funcionam, só desperdiçam tokens — adiado
- Validação de schema do output IA: fallback local cobre falhas
- Cookie replay window (30 dias): single-user, risco aceito
