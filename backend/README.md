# SwiftletCare Backend

Node.js 20 LTS + Express 4 + TypeScript + MongoDB + Redis + EMQX (MQTT). Xem `SwiftletCare_SRS.md` §3.2, §7-9.

## Chạy local

```bash
cp .env.example .env   # điền MONGO_URI, JWT secrets, MQTT broker...
npm install
npm run dev             # ts-node-dev, hot reload
```

`docker-compose.yml` ở gốc repo dựng sẵn MongoDB + Redis + EMQX cho môi trường dev.

## Cấu trúc

```
src/
  config/      Kết nối DB, app Express (đăng ký route/middleware)
  controllers/ Xử lý request/response theo module (thin — gọi service)
  services/    Business logic (TODO, xem WORKPLAN.md theo sprint)
  models/      Mongoose schema (§8.2)
  routes/      Định nghĩa REST endpoint (§9.1) + validation
  middlewares/ auth (JWT+RBAC), rateLimiter, errorHandler, validate
  mqtt/        Client EMQX + handlers theo topic (§9.2)
  socket/      Socket.io realtime events (§9.3)
  types/       Domain enums/interfaces dùng chung
```

## Module → phạm vi

| Module     | Trạng thái            | Ghi chú                                   |
| ---------- | ---------------------- | ------------------------------------------ |
| AUTH/FARM/ENV/ALERT/ANALYTICS | Scaffold sẵn (controller 501) | MVP — cần implement theo WORKPLAN.md |
| TICKET     | Scaffold mới (501)     | MVP — §5.9                                 |
| MARKET     | Scaffold mới (501)     | MVP (landing + form liên hệ) — §5.8        |
| SALES      | Scaffold mới (501)     | Giai đoạn 2, stretch — §5.10               |

Mọi controller trả `501 Not Implemented` cho tới khi được cài đặt theo sprint (xem `SwiftletCare_TASK_DETAIL_Checklist.md` mục C).

## Lệnh hữu ích

```bash
npm run build   # tsc → dist/
npm test        # Jest (unit + integration)
npm run lint
```
