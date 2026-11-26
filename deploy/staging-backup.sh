#!/bin/sh
# Sao lưu MongoDB của staging (G-17, docs/deploy/staging.md §3). Chạy từ gốc repo trên VPS:
#   sh deploy/staging-backup.sh                 # cron 03:00 mỗi ngày, và ngay trước mỗi lần triển khai
#   BACKUP_REMOTE=gdrive:swiftletcare sh deploy/staging-backup.sh   # chép thêm ra ngoài VPS bằng rclone
# Giữ BACKUP_KEEP bản mới nhất (mặc định 7) trong BACKUP_DIR (mặc định ~/backup). Khôi phục: staging.md §3.
set -eu
cd "$(dirname "$0")/.."

DIR=${BACKUP_DIR:-$HOME/backup}
KEEP=${BACKUP_KEEP:-7}
FILE="$DIR/swiftletcare-$(date +%F-%H%M).gz"
mkdir -p "$DIR"

# Cụm Atlas (MONGODB_URI có giá trị trong env): dump từ xa bằng ảnh mongo. Atlas có sao lưu riêng; bản này là bản
# logic thứ hai để chép về máy. Chuỗi nối đi qua biến môi trường, không nằm trên dòng lệnh của VPS
URI=$(sed -n 's/^MONGODB_URI=//p' deploy/.env.staging)
if [ -n "$URI" ]; then
  URI="$URI" docker run --rm -e URI mongo:7.0 sh -c 'mongodump --quiet --uri "$URI" --archive --gzip' \
    > "$FILE" || { rm -f "$FILE"; echo "Sao lưu thất bại: mongodump lỗi" >&2; exit 1; }
else
  # Mật khẩu đọc trong container, không hiện trên dòng lệnh của VPS
  docker compose -f deploy/docker-compose.staging.yml --env-file deploy/.env.staging exec -T mongodb sh -c \
    'mongodump --quiet -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --db swiftletcare --archive --gzip' \
    > "$FILE" || { rm -f "$FILE"; echo "Sao lưu thất bại: mongodump lỗi" >&2; exit 1; }
fi
# Dump lỗi hay rỗng thì bỏ file, để nó không chiếm chỗ của bản tốt trong KEEP bản giữ lại; cron gửi thư báo lỗi
if [ ! -s "$FILE" ]; then
  rm -f "$FILE"
  echo "Sao lưu thất bại: file rỗng" >&2
  exit 1
fi

ls -1t "$DIR"/swiftletcare-*.gz | tail -n +$((KEEP + 1)) | xargs -r rm --
if [ -n "${BACKUP_REMOTE:-}" ]; then
  rclone copy "$FILE" "$BACKUP_REMOTE"
fi
echo "Đã sao lưu: $FILE"
