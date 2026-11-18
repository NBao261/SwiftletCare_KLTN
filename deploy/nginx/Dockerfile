# Nginx của staging kèm bản build web (G-17, Report 4 §3.4): HTTPS cho web, /api, /socket.io, /stream (WHEP) và TLS cho
# MQTT 8883, RTSPS 8322 (khối stream). Build từ gốc repo: docker build -f deploy/nginx/Dockerfile .
FROM node:22-alpine AS web
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# Trang WHEP đi qua cùng tên miền ở /stream (Nginx chuyển tới MediaMTX), không cần tên miền riêng cho video
ARG VITE_STREAM_URL=/stream
ENV VITE_STREAM_URL=$VITE_STREAM_URL
RUN npm run build

FROM nginx:1.27-alpine
RUN rm /etc/nginx/conf.d/default.conf && mkdir -p /var/www/certbot
COPY deploy/nginx/nginx.conf /etc/nginx/nginx.conf
# Ảnh nginx thay ${DOMAIN} trong templates/ (kể cả thư mục con) rồi ghi ra conf.d/ lúc khởi động
COPY deploy/nginx/templates /etc/nginx/templates
COPY --from=web /app/frontend/dist /usr/share/nginx/html
