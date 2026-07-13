# Configuração de API Keys

## Por que existe

O WARP-Unit usa inteligência artificial generativa (Gemini, NVIDIA, Pollinations, Hermes) para criar missões, planetas, descobertas e narrativas emergentes no Gerador de Missão (`oneshot.html`).

Cada usuário fornece **suas próprias chaves de API** para os provedores que desejar usar. As chaves ficam armazenadas no `localStorage` do navegador e são enviadas apenas aos servidores dos provedores.

## Provedores

| Provedor | Chave necessária? | Como é chamado |
|---|---|---|
| **Gemini** | Sim (`warp-gemini-key`) | Direto do browser via Google AI API (`?key=` na URL). Google suporta CORS. |
| **NVIDIA** | Sim (`warp-nvidia-key`) | Via `api/proxy-nvidia.php` com header `X-API-Key` |
| **Pollinations.ai** | Não | Direto do browser (público) |
| **Hermes** | Não | Direto do browser (público) |

## Como configurar

1. Acesse a página **API Keys** no menu de navegação
2. Insira sua chave do Gemini (obtenha grátis em [aistudio.google.com/apikey](https://aistudio.google.com/apikey))
3. Insira sua chave da NVIDIA (obtenha grátis em [build.nvidia.com](https://build.nvidia.com))
4. Clique em "Salvar"

As chaves persistem no `localStorage` entre sessões. Use o botão "Limpar" para removê-las.

## Ordem de tentativa (cascade)

1. **Gemini** (se configurado)
2. **NVIDIA** (se configurado)
3. **Pollinations.ai** (gratuito, sem chave)
4. **Hermes** (gratuito, sem chave)

Se nenhuma chave for configurada, o gerador usa dados de fallback locais (sem IA).

## Anteriormente

O sistema usava autenticação por senha (bcrypt/TOTP) com cookie `warp_auth` HMAC-SHA256 para proteger proxies de IA. Esse sistema foi removido em favor do modelo BYOK (Bring Your Own Key) por simplicidade e segurança — elimina a superfície de ataque de senha, cookie e chave fixa no servidor.
