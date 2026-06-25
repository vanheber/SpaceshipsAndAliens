#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
    echo "Erro: .env não encontrado."
    echo "Copie .env.example para .env e preencha as credenciais."
    exit 1
fi

read_env_var() {
    local key="$1"
    grep "^${key}=" "$ENV_FILE" | head -1 | cut -d= -f2-
}

FTP_HOST=$(read_env_var "FTP_HOST")
FTP_USER=$(read_env_var "FTP_USER")
FTP_PASSWORD=$(read_env_var "FTP_PASSWORD")
FTP_PATH=$(read_env_var "FTP_PATH")
FTP_PORT=$(read_env_var "FTP_PORT")
PORT="${FTP_PORT:-21}"

for var in FTP_HOST FTP_USER FTP_PASSWORD FTP_PATH; do
    if [ -z "${!var:-}" ]; then
        echo "Erro: $var não definido no .env"
        exit 1
    fi
done

if ! command -v lftp &>/dev/null; then
    echo "lftp não encontrado. Instale com: brew install lftp"
    exit 1
fi

echo "Deploy para $FTP_USER@$FTP_HOST:$FTP_PATH ..."

lftp -u "$FTP_USER","$FTP_PASSWORD" -p "$PORT" "$FTP_HOST" <<EOF
set ftp:ssl-allow no
set mirror:use-pget-n 5
mirror --reverse --delete --verbose \
    --exclude .git/ \
    --exclude .env.example \
    --exclude .gitignore \
    --exclude deploy.sh \
    --exclude .DS_Store \
    --exclude node_modules/ \
    --exclude PROMPTS_IMAGENS.md \
    --exclude README.md \
    --exclude ".*\.log$" \
    "$SCRIPT_DIR/" "$FTP_PATH"
EOF

echo "Deploy concluído."
