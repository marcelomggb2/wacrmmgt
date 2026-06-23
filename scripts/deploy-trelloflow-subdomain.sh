#!/usr/bin/env bash
set -euo pipefail

# Deploy static TrelloFlow app from this repo to a VPS subdomain.
# Usage:
#   scripts/deploy-trelloflow-subdomain.sh \
#     --host 1.2.3.4 \
#     --user root \
#     --domain boards.example.com
#
# Optional:
#   --source external/trelloflow
#   --web-root /var/www/boards

HOST=""
USER_NAME="root"
DOMAIN=""
SOURCE_DIR="external/trelloflow"
WEB_ROOT="/var/www/boards"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host)
      HOST="$2"
      shift 2
      ;;
    --user)
      USER_NAME="$2"
      shift 2
      ;;
    --domain)
      DOMAIN="$2"
      shift 2
      ;;
    --source)
      SOURCE_DIR="$2"
      shift 2
      ;;
    --web-root)
      WEB_ROOT="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1"
      exit 1
      ;;
  esac
done

if [[ -z "$HOST" || -z "$DOMAIN" ]]; then
  echo "Missing required args."
  echo "Example:"
  echo "  scripts/deploy-trelloflow-subdomain.sh --host 1.2.3.4 --user root --domain boards.example.com"
  exit 1
fi

if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "Source directory not found: $SOURCE_DIR"
  exit 1
fi

echo "[1/5] Uploading static files to $USER_NAME@$HOST:$WEB_ROOT"
ssh "$USER_NAME@$HOST" "sudo mkdir -p '$WEB_ROOT'"
rsync -av --delete "$SOURCE_DIR/" "$USER_NAME@$HOST:$WEB_ROOT/"
ssh "$USER_NAME@$HOST" "sudo chown -R www-data:www-data '$WEB_ROOT'"

echo "[2/5] Installing Nginx site config for $DOMAIN"
TMP_CONF="$(mktemp)"
cat > "$TMP_CONF" <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    root $WEB_ROOT;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

scp "$TMP_CONF" "$USER_NAME@$HOST:/tmp/boards-nginx.conf"
rm -f "$TMP_CONF"
ssh "$USER_NAME@$HOST" "sudo mv /tmp/boards-nginx.conf /etc/nginx/sites-available/$DOMAIN"
ssh "$USER_NAME@$HOST" "sudo ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/$DOMAIN"

echo "[3/5] Validating and reloading Nginx"
ssh "$USER_NAME@$HOST" "sudo nginx -t && sudo systemctl reload nginx"

echo "[4/5] Attempting SSL certificate with Certbot"
set +e
ssh "$USER_NAME@$HOST" "sudo certbot --nginx -d '$DOMAIN' --non-interactive --agree-tos -m admin@$DOMAIN --redirect"
CERTBOT_EXIT=$?
set -e

if [[ $CERTBOT_EXIT -ne 0 ]]; then
  echo "Certbot failed. Check DNS and rerun on server manually:"
  echo "  sudo certbot --nginx -d $DOMAIN"
else
  echo "SSL configured for https://$DOMAIN"
fi

echo "[5/5] Done. Set NEXT_PUBLIC_BOARDS_URL in your CRM deployment:"
echo "  NEXT_PUBLIC_BOARDS_URL=https://$DOMAIN"
