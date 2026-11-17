#!/bin/sh
# Chứng chỉ TLS của staging (G-17, docs/deploy/staging.md §3). Chạy từ gốc repo sau khi điền deploy/.env.staging:
#   sh deploy/staging-cert.sh               # VPS: xin chứng chỉ Let's Encrypt cho DOMAIN (cổng 80 phải mở)
#   sh deploy/staging-cert.sh --self-signed # thử trên máy: chứng chỉ tự ký, trình duyệt sẽ cảnh báo
# Nginx cần sẵn một chứng chỉ để khởi động, nên trước tiên tạo một chứng chỉ tạm, bật Nginx, rồi mới xin chứng chỉ thật
# qua webroot và nạp lại Nginx.
set -eu

ENV_FILE=deploy/.env.staging
COMPOSE="docker compose -f deploy/docker-compose.staging.yml --env-file $ENV_FILE"
DOMAIN=$(sed -n 's/^DOMAIN=//p' "$ENV_FILE")
EMAIL=$(sed -n 's/^CERTBOT_EMAIL=//p' "$ENV_FILE")
LIVE=/etc/letsencrypt/live/$DOMAIN

echo "Chứng chỉ tạm cho $DOMAIN"
$COMPOSE run --rm --no-deps --entrypoint sh certbot -c "
  test -f $LIVE/fullchain.pem && exit 0
  mkdir -p $LIVE
  openssl req -x509 -nodes -newkey rsa:2048 -days 7 -subj /CN=$DOMAIN \
    -keyout $LIVE/privkey.pem -out $LIVE/fullchain.pem"

$COMPOSE up -d nginx

if [ "${1:-}" = "--self-signed" ]; then
  echo "Giữ chứng chỉ tự ký (thử trên máy)."
  exit 0
fi

echo "Xin chứng chỉ Let's Encrypt cho $DOMAIN"
# Bỏ chứng chỉ tạm để certbot ghi bản thật vào đúng thư mục live/$DOMAIN
$COMPOSE run --rm --no-deps --entrypoint sh certbot -c "
  rm -rf $LIVE /etc/letsencrypt/archive/$DOMAIN /etc/letsencrypt/renewal/$DOMAIN.conf"
$COMPOSE run --rm --no-deps --entrypoint certbot certbot certonly --webroot -w /var/www/certbot \
  -d "$DOMAIN" --email "$EMAIL" --agree-tos --no-eff-email --non-interactive
$COMPOSE exec nginx nginx -s reload
echo "Xong. Nginx đã nạp chứng chỉ mới."
