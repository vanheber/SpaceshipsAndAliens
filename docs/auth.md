# Autenticação WARP-Unit

## Por que existe

O WARP-Unit usa inteligência artificial generativa (Gemini, NVIDIA, Pollinations, Hermes) para criar missões, planetas, descobertas e narrativas emergentes no Gerador de Missão (`oneshot.html`). Essas APIs consomem créditos ou exigem chaves armazenadas no servidor.

A autenticação protege o uso dessas APIs: apenas usuários autorizados podem gerar conteúdo com IA, evitando consumo abusivo e exposição de chaves.

## Como funciona

### Cookie de Sessão

O cookie `warp_auth` é definido pelo servidor (`api/auth.php`) após validação da senha:

```
warp_auth = {timestamp}.{HMAC-SHA256(timestamp, key)}
```

- **Timestamp** unix do login
- **HMAC** com a mesma chave usada pelo proxy da API (`TOTP_SECRET`, `AUTH_PASSWORD` ou `GEMINI_KEY`)
- Validade: 30 dias
- `httponly: true` (inacessível via JavaScript)
- `secure: true` (apenas HTTPS)
- `samesite: Lax`

### Endpoints (`api/auth.php`)

| Método | Função |
|---|---|
| **GET** | Verifica se o cookie atual é válido → `{ ok: true/false }` |
| **POST** | Login: recebe `{ password }`, valida contra `AUTH_PASSWORD` (bcrypt) → seta cookie |
| **DELETE** | Logout: remove o cookie |

### Ordem de validação da senha

1. `AUTH_PASSWORD` — hash bcrypt (prefixo `$2y$` ou `$2a$`), via `password_verify()`
2. `TOTP_SECRET` — comparação direta da string
3. `GEMINI_KEY` — comparação direta (fallback, não recomendado)

### Proxy da IA (`api/proxy.php`)

O proxy da Gemini lê o mesmo cookie `warp_auth` e rejeita requisições não autenticadas com HTTP 401.

## Interface

### `login.html`
- Formulário de senha com validação via `api/auth.php`
- Exibe status online/offline com badge verde/vermelho
- Botão "Sair" quando autenticado

### Menu
Todas as páginas incluem no menu:
```html
<a href="login.html" class="auth-menu-link">Entrar</a>
```
Um script IIFE checa `api/auth.php` via GET e troca o texto para "Sair" se autenticado.

## Setup

No arquivo `.env` do servidor:
```env
AUTH_PASSWORD=$2y$10$...  # hash bcrypt da senha
# ou
TOTP_SECRET=JBSWY3DPEHPK3PXP  # chave secreta
```

## Segurança

- Cookie `httponly` + `secure` + `samesite=Lax`
- HMAC-SHA256 evita forgery do cookie
- `Access-Control-Allow-Credentials: true` nas APIs
- CORS com allowlist de origins (localhost, domínios do projeto)
