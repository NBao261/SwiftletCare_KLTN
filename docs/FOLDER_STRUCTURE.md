# SwiftletCare — Cấu trúc thư mục

Bản đồ repo: mỗi thứ nằm ở đâu, và quy tắc chi tiết của từng module đọc ở file nào. File này chỉ giữ phần **khung**; quy tắc đặt tên, đặt file và cách viết code nằm trong file quy tắc của từng module (cột "Quy tắc" bên dưới) — khi hai nơi khác nhau, file của module đúng.

## Thư mục gốc

```
SwiftletCare_KLTN/
├── backend/             # REST API + MQTT + Socket.io (Node.js, Express, TypeScript, MongoDB)
├── frontend/            # Web dashboard / PWA (React 18, Vite, TailwindCSS)
├── mobile/              # App di động (Expo Router, React Native)
├── firmware/            # ESP32 (PlatformIO): cảm biến RS485, điều khiển mờ, MQTT, loa ru
├── ai-pipeline/         # Đếm chim yến (YOLO26n ONNX + ByteTrack) — mới là khung
├── docs/                # Tài liệu (xem mục "docs/")
├── .github/             # CI (workflows/ci.yml), CODEOWNERS, PR template
├── .claude/             # Lệnh /review-pr và cấu hình Claude Code
├── docker-compose.yml   # Môi trường dev: MongoDB, EMQX, MinIO, Redis
├── SwiftletCare_SRS.md  # Đặc tả yêu cầu — mục 0 là phạm vi hiện hành (v2.0.0)
├── CLAUDE.md            # Hướng dẫn chung cho mọi module + quy tắc liên module
├── README.md            # Giới thiệu, cách chạy local
└── .commitlintrc.json   # type/scope hợp lệ cho commit message
```

Ở gốc chỉ để những thứ cả repo dùng chung. Tài liệu mới đặt trong `docs/`, không đặt ở gốc.

**Nguyên tắc chung**
- Mỗi module là một project độc lập (`package.json` / `platformio.ini` / `requirements.txt` riêng, không có workspace chung). **Không import code chéo giữa các module** — chúng nói chuyện qua HTTP (`docs/api/api-spec.yaml`), Socket.io và MQTT.
- Những gì phải khớp giữa các module (API contract, enum dùng chung, payload MQTT, mô hình mờ firmware ↔ backend, tên và khoảng của tham số runtime) ở mục "Cross-module rules" của `CLAUDE.md` gốc.
- Không commit secret (`.env`, `Secrets.h`, chứng chỉ), model ONNX, clip hay dataset.

## Từng module

| Module | Khung thư mục | Quy tắc (đọc theo thứ tự, file đầu thắng) |
|---|---|---|
| `backend/` | `src/{routes,controllers,services,models,middlewares,jobs,mqtt/handlers,socket,utils,config,types,scripts}` · `tests/{unit,integration}` | `backend/CLAUDE.md` · `backend/README.md` · `backend/.eslintrc.cjs` |
| `frontend/` | `src/{apis,components/{ui,common,features/<role>,layouts,auth},constants,hooks,lib,pages/<role>,providers,routes,stores,types,validations}` | `frontend/FE_Design_Claude.md` (§12 cấu trúc + đặt tên, §13 quy tắc code) · `frontend/CLAUDE.md` (cấu trúc như code hiện tại) · `frontend/README.md` |
| `mobile/` | `app/` (Expo Router: `(auth)`, `(tabs)`, route chi tiết) · `config/ constants/ hooks/ services/{api,socket,notification} store/ types/ utils/` | `mobile/CLAUDE.md` · `mobile/README.md` |
| `firmware/` | `src/{sensors,pid,mqtt,storage,wifi,audio,config}` + `main.cpp` · `test/` (unit test chạy trên máy) | `firmware/CLAUDE.md` · `firmware/README.md` |
| `ai-pipeline/` | `src/` · `config/config.yaml` · cấu trúc đích ở `docs/bird-counting-plan.md` §4 | `ai-pipeline/CLAUDE.md` · `ai-pipeline/README.md` · `docs/bird-counting-plan.md` |

Đặt nhanh một file mới:

| Tôi đang thêm… | Đặt vào |
|---|---|
| Endpoint backend | `backend/src/routes/<resource>.route.ts` → `controllers/<resource>.controller.ts` → `services/<resource>.service.ts` (+ cập nhật `docs/api/api-spec.yaml`) |
| Job chạy định kỳ / xử lý tin MQTT | `backend/src/jobs/<việc>.job.ts` / `backend/src/mqtt/handlers/<topic>.handler.ts` |
| Trang web | `frontend/src/pages/<role>/<Role><Tên>Page.tsx` + route trong `frontend/src/routes/<role>.routes.tsx` |
| Thành phần của một trang web | `frontend/src/components/features/<role>/<khu vực>/` (không đặt trong `pages/`) |
| Màn hình mobile | `mobile/app/...` theo đường dẫn route |
| Logic điều khiển / lọc / phát hiện trên ESP32 | `firmware/src/<nhóm>/` dạng C++ thuần + test trong `firmware/test/` |
| Tài liệu | `docs/` (xem dưới) |

## `docs/`

```
docs/
├── FOLDER_STRUCTURE.md     # file này
├── api/                    # api-spec.yaml (OpenAPI 3.0 — nguồn sự thật của API) + README
├── bird-counting-plan.md   # kế hoạch triển khai đếm chim (module VISION)
├── evidence-register.md   # sổ tài liệu tham khảo & minh chứng cho các con số, thiết bị (EVID-NFR-003)
├── diagrams/               # sơ đồ draw.io: context-diagram/, system-architecture/ (file chính: artifacts/diagram.drawio)
├── hardware/               # BOM.md, components-guide.md (linh kiện + đấu nối)
├── sprint-reviews/         # biên bản review theo sprint
├── test-reports/           # báo cáo kiểm thử (đang trống)
├── task-checklist.md       # checklist việc theo sprint/thành viên
└── github-setup.md         # quy trình Git/GitHub của nhóm
```
