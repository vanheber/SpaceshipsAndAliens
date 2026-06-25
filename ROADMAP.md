# Roadmap — WARP-Unit

## v1.1-beta (atual)
- [x] Autenticação bcrypt + TOTP (Google Authenticator)
- [x] Cookie HMAC-SHA256 (`warp_auth`, 30d)
- [x] Proxy Gemini 3.1 Flash Lite (`api/proxy.php`) — auth
- [x] Proxy NVIDIA DeepSeek V4 Flash (`api/proxy-nvidia.php`) — público/visitantes
- [x] Cascade multi-provedor: Gemini → NVIDIA → Pollinations → Hermes → Local
- [x] Contexto narrativo rico (últimos 3 eventos completos)
- [x] Login modal com senha + TOTP
- [x] Badge do provedor ativo
- [x] `.env` protegido por `.htaccess`
- [x] Deploy via lftp (`deploy.sh`)
- [x] Persistência de missão em localStorage

## Próximos

### S2 — Adicionar OpenCode DeepSeek V4 Flash como provedor reserva
**Prioridade:** Baixa | **Esforço:** 30min
- O modelo `deepseek-ai/deepseek-v4-flash` já está disponível via NVIDIA
- Investigar se há endpoint público adicional

### S3 — Dashboard de Admin
**Prioridade:** Baixa | **Esforço:** 3h
- Estatísticas de uso por provedor
- Log de erros
- Gerenciar chaves (senha, TOTP)

### S4 — CI/CD
**Prioridade:** Baixa | **Esforço:** 1h
- GitHub Actions: validar PHP syntax nos PRs
- Health check automatizado dos endpoints

## Como testar
```bash
# Login
curl -s -c /tmp/cookies.txt https://warp.imaginaris.com.br/api/auth.php \
  -X POST -H "Content-Type: application/json" \
  -d '{"password":"SUA_SENHA","totp":"CODIGO_GOOGLE_AUTH"}'

# Proxy Gemini (com cookie de auth)
curl -s -b /tmp/cookies.txt https://warp.imaginaris.com.br/api/proxy.php \
  -X POST -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Gere um planeta"}]}'

# Proxy NVIDIA (sem auth — público)
curl -s https://warp.imaginaris.com.br/api/proxy-nvidia.php \
  -X POST -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Gere um planeta"}]}'
```
