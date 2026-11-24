# Backend cho staging (G-17, Report 4 §3.4, §11). Build từ gốc repo để có docs/api/api-spec.yaml cho Swagger UI:
#   docker build -f backend/Dockerfile .
FROM node:22-alpine
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
# Giữ devDependencies: chạy bằng tsx (alias @/) như `npm run dev`, và cần cho `npm run seed`, `npm run migrate:*`
RUN npm ci && npm cache clean --force
COPY backend/ ./
# app.config.ts đọc spec ở ../../../docs/api/api-spec.yaml tính từ src/config
COPY docs/api/api-spec.yaml /app/docs/api/api-spec.yaml
ENV NODE_ENV=production PORT=3000
# Không chạy bằng root. Volume backend_storage lần đầu lấy quyền của thư mục này trong ảnh, nên tạo sẵn cho user node
RUN mkdir -p /app/storage && chown node:node /app/storage
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 CMD wget -qO- http://127.0.0.1:3000/health > /dev/null || exit 1
CMD ["npx", "tsx", "src/index.ts"]
