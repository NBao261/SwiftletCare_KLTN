# SwiftletCare API Documentation
**Version:** 1.0.0 | **Dev base URL:** `http://localhost:3000` (production TBD, chưa deploy)

## Authentication
Hầu hết endpoint (trừ `/auth/*`, `/marketplace/*` public, `/orders` guest checkout...) yêu cầu `Authorization: Bearer <access_token>`

## Xem API

`api-spec.yaml` (cùng thư mục) là OpenAPI 3.0 spec đầy đủ — nguồn sự thật duy nhất, sửa file này khi thêm/đổi endpoint. Backend tự serve Swagger UI đọc trực tiếp file này, không cần đọc YAML tay:

- Chạy `npm run dev` trong `backend/` rồi mở `http://localhost:3000/api-docs`
- Hoặc paste nội dung `api-spec.yaml` vào https://editor.swagger.io để xem offline

Endpoint thuộc các tag ghi "(stub)" là stub (501, chưa có logic thật) — xem `backend/README.md` mục "Module → phạm vi" để biết trạng thái từng module.
