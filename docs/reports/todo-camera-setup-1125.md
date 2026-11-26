# Cài đặt camera đếm chim từ web (25/11/2026)

**Quyết định (Bảo, 25/11/2026):** camera IP mua ngoài được khai trên web, nút AI nhận danh tính bằng một mã cài đặt dùng một lần, rồi tự lấy địa chỉ camera qua kênh có xác thực và báo lại tình trạng camera. Không ai phải chép mật khẩu vào file trên máy nút AI nữa. Report 3 FARM-FR-004, 004b, 010 (4.2.25), Report 4 D22 (2.2.30).

## 1. Vấn đề

Trong hệ thống, "camera" là **nút AI** (máy chạy `ai-pipeline`), không phải camera IP (VD TP-Link VIGI C320I). Hiện có hai bộ mã:

- **Camera IP:** tài khoản `admin` đặt trong app của hãng, nằm trong địa chỉ RTSP `rtsp://admin:<mật khẩu>@<IP>:554/stream1`.
- **Nút AI:** mã thiết bị, mã kích hoạt (nhãn) và mật khẩu broker do màn Kho thiết bị cấp.

Cách làm hiện tại có bốn chỗ hở:

1. Mật khẩu broker chỉ hiện một lần, phải chép tay vào `ai-pipeline/.env`, rất dễ sai.
2. Đổi mật khẩu camera phải vào tận máy nút AI để sửa `.env`.
3. API đăng ký camera nhận `rtsp_url` và lưu **không mã hoá** (dạng rõ) trong database, nhưng nút AI không bao giờ đọc giá trị này.
4. Không màn nào cho biết nút AI có đọc được camera không. Nút AI còn đẩy hình bằng một mật khẩu dùng chung (`STREAM_PUBLISH_SECRET`), lộ một máy là lộ cả hệ thống video.

## 2. Cách làm (theo các hệ thống quản lý camera qua cloud)

### 2.1. Nút AI nhận danh tính bằng mã cài đặt

1. **Administrator**, màn Kho thiết bị, ở một mục loại "Camera đếm chim", bấm "Mã cài đặt nút AI". Hệ thống hiện mã 8 ký tự (VD `7KQ2-M9XA`), dùng một lần, hết hạn sau 30 phút, kèm lệnh cần chạy. Backend chỉ lưu SHA-256 của mã.
2. **Trên máy nút AI:** chạy `python tools/setup_node.py --server https://<tên miền>/api` rồi nhập mã. Công cụ gọi `POST /agent/enroll`. Backend kiểm mã, xoá mã, cấp mật khẩu broker mới (máy cũ, nếu có, bị ngắt), rồi trả:
   - mã thiết bị và mật khẩu broker;
   - địa chỉ broker (máy chủ, cổng, TLS);
   - địa chỉ đẩy hình.
3. Công cụ ghi các giá trị đó vào `.env`, thử đăng nhập broker rồi báo kết quả.

Cách này làm cho nút AI đúng việc trạm nạp USB làm cho bộ điều khiển (FARM-FR-010): không ai nhìn thấy hay chép mật khẩu broker.

### 2.2. Địa chỉ camera khai trên web, lưu mã hoá

- **Farm Owner**, trên thẻ camera của nhà, bấm "Cài đặt camera" rồi nhập:
  - địa chỉ (IP hoặc tên miền);
  - cổng (mặc định 554);
  - tài khoản (mặc định `admin`);
  - mật khẩu;
  - đường dẫn luồng (mặc định `/stream1`; có gợi ý theo hãng).

  Có thể dán nguyên địa chỉ RTSP để tự tách thành các ô. Đây là việc thiết lập thiết bị của Farm Owner (SF-01, Report 3 §2.4). Kỹ thuật viên, Chuyên gia và Administrator không sửa.
- **Backend** lưu mật khẩu bằng AES-256-GCM với khoá riêng `CAMERA_SOURCE_KEY`; thiếu khoá thì trả 503.
  - Đọc lại chỉ trả các ô không bí mật và `has_password`. Để trống ô mật khẩu khi sửa thì giữ mật khẩu cũ.
  - Mỗi lần sửa thì tăng `camera_source.version` và gửi lại `config` retained của nút AI kèm `camera_source_version`. Tin này **không** chứa mật khẩu.
- **Nút AI** thấy số phiên bản đổi (hoặc lúc khởi động) thì gọi `GET /agent/camera-source`:
  - xác thực Basic bằng mã thiết bị và mật khẩu broker, kiểm như `/internal/mqtt-auth`;
  - nhận địa chỉ RTSP, giữ trong bộ nhớ (không ghi ra đĩa), rồi mở lại luồng camera.

  `CAMERA_RTSP_URL` trong `.env` vẫn thắng, dùng cho máy dev chạy clip.
- **Dọn dữ liệu cũ:**
  - bỏ `rtsp_url` khỏi API đăng ký camera;
  - `npm run migrate:camera-source` chuyển các `rtsp_url` đang lưu không mã hoá (giữ nguyên hoa thường) sang dạng mã hoá rồi xoá trường cũ; chạy lại nhiều lần vẫn an toàn.

Vì sao mật khẩu không nằm trong `config` retained: broker lưu tin retained (có thể ra đĩa), và tin đó gửi lại mỗi lần kết nối. Lấy qua HTTPS khi cần thì mật khẩu chỉ nằm ở backend (mã hoá) và trong bộ nhớ nút AI.

### 2.3. Tình trạng camera thấy được trên web

- **Heartbeat của nút AI** thêm `cameraStatus`:
  - `OK`: đang nhận hình;
  - `NO_SOURCE`: chưa có địa chỉ;
  - `AUTH_FAILED`: sai tài khoản hoặc mật khẩu;
  - `UNREACHABLE`: không kết nối được;
  - `NO_FRAMES`: kết nối được nhưng không có hình.

  Khi không đọc được luồng, nút AI phân loại lỗi bằng `ffprobe` (đã có sẵn cùng ffmpeg của bộ đẩy hình): `401 Unauthorized` là `AUTH_FAILED`; bị từ chối hoặc hết thời gian chờ là `UNREACHABLE`.
- **Backend** lưu `camera_status`, `camera_status_at` trên CameraNode (chỉ nhận giá trị trong danh sách). Web đọc lại mỗi 30 giây khi đang mở thẻ camera (không thêm sự kiện socket).
- **Web** hiện trên thẻ camera: "Đang nhận hình", "Chưa nhập địa chỉ camera", "Sai mật khẩu camera", "Không kết nối được camera", "Kết nối được nhưng không có hình".
- Không thêm loại cảnh báo (enum dùng chung giữ nguyên). Mất camera vẫn báo bằng `EDGE_AI_DEGRADED` như hiện tại.

### 2.4. Đẩy hình bằng tài khoản riêng của nút AI

- `/internal/stream-auth` nhận thêm cách đăng nhập: tài khoản là mã thiết bị, mật khẩu là mật khẩu broker của chính camera đó (camera đang dùng, mục kho chưa thu hồi). Cách này chỉ cho:
  - đẩy hình lên `cam-<mã>` và `cam-<mã>-raw`;
  - đọc `cam-<mã>-raw`.
- Mã cài đặt trả sẵn địa chỉ đẩy hình từ biến mới `STREAM_PUBLISH_BASE` (VD `rtsps://<tên miền>:8322`).
- `STREAM_PUBLISH_SECRET` giữ thêm một bản phát hành để nút AI đang chạy không đứt hình. Bỏ hẳn khi nút AI trên staging đã cài lại (ghi ở §5).

## 3. Việc từng phần

| # | Phần | Việc |
|---|---|---|
| D-1 | Tài liệu | Report 3 4.2.25: FARM-FR-004 (bỏ `rtsp_url` khi đăng ký), FARM-FR-004b mới (địa chỉ camera, mã hoá, nút AI tự lấy, tình trạng camera), FARM-FR-010 (mã cài đặt nút AI), §2.4, §4.5. Report 4 2.2.30: D22 mới, D5, §5.4, §6, §7.2. `backend/CLAUDE.md`, `ai-pipeline/README.md`, CLAUDE.md gốc, `docs/deploy/staging.md` |
| B-1 | Backend | Mã cài đặt: trường `setup_code_hash`, `setup_code_expires_at` trên mục kho; `POST /admin/provisioned-devices/:id/setup-code` (Administrator, chỉ loại CAMERA chưa thu hồi); `POST /agent/enroll` (không đăng nhập, giới hạn tần suất theo IP như đăng nhập); audit `AI_NODE_SETUP_CODE_ISSUED`, `AI_NODE_ENROLLED` |
| B-2 | Backend | Địa chỉ camera: `utils/secretBox.util.ts` (AES-256-GCM, test), trường `camera_source` trên CameraNode; `GET`/`PUT /devices/camera-nodes/:id/source` (Farm Owner của nhà); `camera_source_version` trong `config` của nút AI; `GET /agent/camera-source` (Basic, mã thiết bị và mật khẩu broker; router riêng `/agent` vì `/devices` bắt đăng nhập người dùng); bỏ `rtsp_url` khi đăng ký; `migrate:camera-source`; audit `CAMERA_SOURCE_UPDATED` (không ghi mật khẩu) |
| B-3 | Backend | `cameraStatus` trong heartbeat → `camera_status`, `camera_status_at` |
| B-4 | Backend | `/internal/stream-auth` nhận tài khoản thiết bị cho đúng đường của nó; `STREAM_PUBLISH_BASE` |
| B-5 | Backend | Spec, `.env.example`, `deploy/` (biến mới trên staging), `db:script`, test tích hợp cho từng route và từng ca từ chối |
| A-1 | AI pipeline | `tools/setup_node.py`: nhập mã → `/agent/enroll` → ghi `.env` (giữ các dòng khác) → thử broker |
| A-2 | AI pipeline | Lấy địa chỉ camera khi khởi động và khi `camera_source_version` đổi; mở lại luồng; `CAMERA_RTSP_URL` vẫn thắng |
| A-3 | AI pipeline | `cameraStatus` trong heartbeat, phân loại lỗi bằng `ffprobe`; pytest cho ghi `.env`, dựng địa chỉ, phân loại lỗi |
| W-1 | Web (Admin, Nhi duyệt) | Màn Kho thiết bị: thao tác "Mã cài đặt nút AI" ở mục loại camera, cửa sổ hiện mã, thời gian còn lại, lệnh chạy |
| W-2 | Web (Farm Owner, Nhi duyệt) | Thẻ camera của nhà: nút "Cài đặt camera" (form, dán địa chỉ RTSP để tách ô) và nhãn tình trạng camera; bỏ `rtsp_url` khỏi kiểu đăng ký |
| M-1 | Mobile (Len) | Cùng form và nhãn tình trạng ở màn cài đặt nhà, sau khi spec merge. **Đã làm (Len, 26/11, `fix/mobile-farmowner-audit`):** hàng camera ở Cài đặt nhà ghi tình trạng camera IP (cam khi sai mật khẩu, không kết nối được, không có hình); menu của camera có "Cài đặt camera" mở `CameraSourceSheet`: tình trạng, ô dán địa chỉ RTSP để tách ô, địa chỉ, cổng, tài khoản, mật khẩu ("Để trống để giữ mật khẩu đã lưu"), chip đường dẫn theo hãng, câu bảo mật; 503 báo máy chủ chưa sẵn sàng. `utils/cameraSource.utils.ts` có test. Kiểm API đầu cuối (lưu 200, `has_password`, kỹ thuật viên 403); chưa chạy được trên emulator. |

**Thứ tự:** D-1 → B-1…B-5 → A-1…A-3 → W-1, W-2, trên một nhánh `feat/camera-setup-from-web`. PR mở sau khi #247 vào `develop` (nhánh này dựa trên #247 vì cùng sửa kho thiết bị và số phiên bản Report). M-1 là PR riêng của Len.

## 4. Hằng số chọn tay (Report 3 §4.5, A-4)

- Mã cài đặt: 8 ký tự trong 31 ký tự dễ đọc của nhãn (bỏ `0`, `O`, `1`, `I`, `L`), hết hạn sau 30 phút, dùng một lần.
- Phân loại lỗi camera: `ffprobe` chờ tối đa 10 giây.
- Giới hạn ô nhập:
  - tài khoản tối đa 64 ký tự;
  - mật khẩu tối đa 128 ký tự;
  - đường dẫn luồng tối đa 200 ký tự, bắt đầu bằng `/`;
  - cổng 1–65535.

## 5. Kiểm tra trên staging (trước khi coi là xong)

Với camera VIGI thật ở nhà yến và nút AI trên máy của nhóm:

1. Tạo mã cài đặt, chạy `setup_node.py`: `.env` có đủ giá trị và nút AI nối được broker.
2. Farm Owner nhập địa chỉ camera trên web: nút AI tự mở luồng trong 1 phút, thẻ hiện "Đang nhận hình".
3. Đổi mật khẩu camera trong app của hãng mà chưa sửa trên web: thẻ hiện "Sai mật khẩu camera". Sửa trên web: hình về lại.
4. Hình đã vẽ khung vẫn xem được trên trang Đàn chim khi nút AI đẩy hình bằng tài khoản riêng.

Xong thì bỏ `STREAM_PUBLISH_SECRET` khỏi nút AI và khỏi backend.
