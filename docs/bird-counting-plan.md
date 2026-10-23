# Kế hoạch triển khai đếm chim yến real-time (Module VISION)

> **Đọc trước — Report 3/Report 4 thắng kế hoạch này.** Yêu cầu là Report 3 §3.8 (VISION-FR) trong `docs/reports/report3-srs.md`, thiết kế là Report 4 §5.2, D5–D6 trong `docs/reports/report4-sdd.md`. Những chỗ kế hoạch dưới đây đã cũ so với hai Report:
> - **Đếm bằng vòng khép kín quanh miệng lỗ** + theo vết cả khung + ngoại suy chim lao nhanh (mục 19.8, BR-25), không phải vạch ảo — đoạn code "đếm qua vạch ảo" ở mục 6 là bản cũ.
> - **Camera, số đếm và cảnh báo thuộc House**: topic `swiftletcare/{farm}/{house}/vision/bird-count|heartbeat|vision/alert`, không có Zone (Report 3 §2.8) — ví dụ còn `F/H/Z` ở mục 8 là bản cũ.
> - **Phiên do backend tính** từ số đếm 5 phút theo lịch đếm của nhà yến: hồ sơ theo mùa + khung tạm thời do Domain Expert đặt, không có thì mặc định 05:30–07:00 và 17:30–19:00 (VISION-FR-008, 019, BR-13); ngày nút AI mất kết nối giữa phiên là phiên không đầy đủ (VISION-FR-020); job so tỷ lệ chim về chạy 15 phút sau khung chiều của ngày đó (BR-21), không cố định 19:15. Khung `sessions` trong `config.yaml` chỉ còn là mặc định. Phần backend của các điểm này chưa làm (`docs/reports/README.md` #20, #24).
> - **Vòng đếm do Domain Expert vẽ** trên khung hình live (VISION-FR-018); farm chưa có chuyên gia thì Farm Owner vẽ (BR-22). Người xem live stream: Farm Owner và Domain Expert của farm (VISION-FR-013).
> - Hằng số tự chọn (khoảng chồng 2 ô, mốc ngoại suy, vòng nới 60 px…) ghi ở Report 3 §4.5.
> - **AI node là PC cũ của nhóm đặt tại nhà yến** (Report 4 D5, §11; `docs/deploy/staging.md`, 23/10/2026): PC lấy RTSP của camera trong LAN, gửi MQTT TLS và đẩy video có khung lên VPS. Dòng "không đặt máy tính tại nhà yến" bên dưới, mục 15.2 bước 1 (VPS 4 vCPU / 8 GB) và mục 18–19.4 (VPS kéo hình qua cổng 18554) đã cũ; VPS staging chỉ cần 2 vCPU / 4 GB, cổng 18554 trên modem nên đóng.

> Phạm vi: VISION-FR-001…014, 016, 017 (đếm chim, live stream có khung nhận diện, báo cáo độ chính xác, số đếm theo khoảng 5 phút).
> **[SRS v2.0.0]** Phiếu đăng ký bản sửa đã chính thức bỏ phát hiện thiên địch và lấy đếm chim làm phần AI duy nhất: live stream có khung (VISION-FR-014) là **bắt buộc**, thêm **VISION-FR-016** (báo cáo Precision/Recall và sai số đếm trên video quay sẵn, tách ban ngày / thiếu sáng). Người xem stream là Farm Owner và Domain Expert (role thay cho Farm Operator).
> **Kiến trúc đã chốt:** không dùng Raspberry Pi và không đặt máy tính tại nhà yến. Model chạy trong một container trên VPS; VPS kéo hình thẳng từ camera qua Internet của nhà yến (mục 1, 18, 19). Đặt một PC tại nhà yến chỉ còn là phương án lùi.
> **Triển khai trên cloud** (đã chốt): backend, MQTT broker và máy chủ video chạy trên một VPS công khai, vì hội đồng xem demo từ xa. Chi tiết ở [mục 15](#15-gđ-c--triển-khai-cloud).
> Trạng thái: **kế hoạch**. Toàn bộ code trong tài liệu này là bản thiết kế, **chưa được chạy thử** — phải kiểm tra lại ở từng giai đoạn theo tiêu chí "Xong khi".

## Mục lục

1. [Tổng quan giải pháp](#1-tổng-quan-giải-pháp)
2. [Hiện trạng code và những chỗ phải sửa](#2-hiện-trạng-code-và-những-chỗ-phải-sửa)
3. [Phần cứng](#3-phần-cứng)
4. [Phần mềm và môi trường](#4-phần-mềm-và-môi-trường)
5. [GĐ0 — Chuẩn bị](#5-gđ0--chuẩn-bị)
6. [GĐ1 — Pipeline đếm + ô xanh](#6-gđ1--pipeline-đếm--ô-xanh)
7. [GĐ2 — Thu dữ liệu, gán nhãn, train model](#7-gđ2--thu-dữ-liệu-gán-nhãn-train-model)
8. [GĐ3 — Backend](#8-gđ3--backend)
9. [GĐ4 — Frontend](#9-gđ4--frontend)
10. [GĐ5 — Chạy thật và ổn định](#10-gđ5--chạy-thật-và-ổn-định)
11. [GĐ6 — Đánh giá và tài liệu](#11-gđ6--đánh-giá-và-tài-liệu)
12. [Phần tùy chọn](#12-phần-tùy-chọn)
13. [Rủi ro](#13-rủi-ro)
14. [Lịch và checklist](#14-lịch-và-checklist)
15. [GĐ-C — Triển khai cloud](#15-gđ-c--triển-khai-cloud)
16. [Hai chế độ chạy: dev và deploy](#16-hai-chế-độ-chạy-dev-và-deploy)
17. [Nhà yến dùng 4G và máy tính tại chỗ](#17-nhà-yến-dùng-4g-và-máy-tính-tại-chỗ)
18. [Phương án ưu tiên: chạy model trên cloud, không đặt máy tại nhà yến](#18-phương-án-ưu-tiên-chạy-model-trên-cloud-không-đặt-máy-tại-nhà-yến)
19. [Cấu hình đã chốt: Internet VNPT có IP public + camera IP nối dây](#19-cấu-hình-đã-chốt-internet-vnpt-có-ip-public--camera-ip-nối-dây)

> **Đọc theo thứ tự nào:** mục 1 mô tả kiến trúc hiện hành. Mục 5–11 là code và quy trình dùng chung cho mọi phương án. Mục 15 (hạ tầng cloud), 18 (model chạy trên VPS) và 19 (Internet VNPT + camera) là chi tiết của kiến trúc hiện hành. Mục 17 (4G) và mọi chỗ nhắc "PC nhà yến" là phương án lùi, chỉ đọc khi trượt cổng kiểm tra ở mục 19.5.

---

## 1. Tổng quan giải pháp

```
NHÀ YẾN                                          CLOUD (VPS, có tên miền + HTTPS)
───────                                          ────────────────────────────────
Camera IP (RTSP, H.264, 25 fps)
   │ LAN (PoE)
   ▼
Modem VNPT (IP public, mở 1 cổng về camera) ──Internet──► MediaMTX kéo hình gốc  "cam-<id>-raw"
                                                              │
ESP32 các Zone ──MQTT qua TLS (8883)──► EMQX                  ▼
                                                    pipeline (container `vision`)
                                                    [crop ROI → YOLO26n (ONNX) → ByteTrack → vạch đếm → vẽ ô xanh]
                                                       │ MQTT nội bộ                 │ đẩy lại MediaMTX "cam-<id>"
                                                       │  • số đếm của phiên, 30 giây/lần
                                                       │  • số đếm theo khoảng 5 phút, cả ngày
                                                       ▼                             ▼
                                                    backend ──(MediaMTX hỏi quyền)── MediaMTX ── WebRTC (WHEP)
                                                       │ upsert BirdCountRecord                     │
                                                       │ lưu BirdCountBucket                        ▼
                                                       │ emit BIRD_COUNT_UPDATE       frontend (HTTPS): <video> có ô xanh
                                                       ▼                              + số vào/ra live ◄── hội đồng xem từ xa
                                                    MongoDB
```

Sơ đồ trên là chế độ **deploy** theo kiến trúc đã chốt. Ở chế độ **dev**, mọi khối bên phải chạy ngay trên laptop bằng Docker, nguồn hình là file clip và không có TLS; code giống hệt, chỉ khác cấu hình (xem [mục 16](#16-hai-chế-độ-chạy-dev-và-deploy)).

Tại nhà yến chỉ có camera, modem và các ESP32. Nếu trượt cổng kiểm tra ở mục 19.5 thì quay về phương án đặt một máy tính tại nhà yến chạy đúng pipeline này (mục 18.7); khi đó kết nối đi từ nhà yến ra và không phải mở cổng nào trên modem.

Hệ quả phải chấp nhận của kiến trúc đã chốt, cần ghi vào phần hạn chế của báo cáo:

- **Việc đếm phụ thuộc Internet của nhà yến.** Mất mạng hoặc rớt hình lúc nào thì số đếm thiếu lúc đó (điều khiển môi trường trên ESP32 không bị ảnh hưởng).
- **Hình gốc từ camera tới VPS không mã hóa** và đi qua một cổng mở trên modem (mục 19.4).
- **VPS xử lý video cả ngày**, vì số đếm theo khoảng 5 phút cần cả ngoài hai phiên sáng, chiều.

Các quyết định thiết kế:

| Quyết định | Lý do |
|---|---|
| Model chạy trên VPS, không đặt máy tại nhà yến | Nhóm không có máy dư; nhà yến có Internet cố định và IP public nên VPS kéo hình trực tiếp được. Có 6 cổng kiểm tra có/không (mục 19.5) |
| Runtime dùng `onnxruntime` + `supervision`, **không cài torch** | `supervision` có sẵn ByteTrack và đếm qua vạch bất kỳ; không phải build ByteTrack từ source. `ultralytics`/torch chỉ dùng trên Colab để train |
| Vẽ ô xanh thẳng lên frame rồi mới phát | Khung luôn khớp hình. Gửi tọa độ qua socket cho frontend tự vẽ sẽ lệch pha với video |
| Xem bằng WebRTC qua MediaMTX | Độ trễ dưới khoảng 1–2 giây, H.264 tốn băng thông ít hơn MJPEG nhiều lần |
| MJPEG qua HTTP chỉ dùng khi dev | Mở `http://127.0.0.1:8090/stream` trên máy đang chạy pipeline để hiệu chỉnh ROI và vạch đếm |
| Một tên miền, Caddy làm reverse proxy | Caddy tự cấp HTTPS và lặp lại đúng proxy của Vite (`/api`, `/socket.io`), nên frontend không cần đổi cấu hình và cookie refresh `sameSite: strict` vẫn hoạt động |
| Nguồn vào là RTSP **hoặc** file video | Dev, gán nhãn và đo độ chính xác đều làm được khi chưa có camera |
| Một class `swiftlet` | SRS v2.1 đã bỏ phát hiện thiên địch |
| Lưu 1 bản ghi cho mỗi (camera, phiên, ngày) **và** 1 bản ghi cho mỗi khoảng 5 phút | Bản ghi theo phiên cho tỷ lệ chim về. Bản ghi 5 phút (VISION-FR-017) là dữ liệu để đối chiếu với cảnh báo ồn bất thường, kể cả ngoài phiên (SRS Flow 25, EXPERT-FR-003) |
| Tỷ lệ chim về tính trên **số ròng** | Chim lượn qua lại vạch đếm làm cả hai chiều phồng lên; số ròng (ra trừ vào buổi sáng, vào trừ ra buổi chiều) triệt tiêu phần đó. Số thô vẫn được lưu để so hai cách khi đánh giá (mục 7.7) |

---

## 2. Hiện trạng code và những chỗ phải sửa

| File | Tình trạng | Việc cần làm |
|---|---|---|
| `ai-pipeline/src/tracker.py` | Stub: `update()` luôn trả danh sách rỗng → hiện không đếm được con nào | Xóa, dùng `sv.ByteTrack` |
| `ai-pipeline/src/counting.py` | Chỉ vạch ngang, hướng ra/vào hard-code | Viết lại quanh `sv.LineZone` |
| `ai-pipeline/src/stream.py` | Không publish MQTT, không đổi phiên, không vẽ, không phát stream; `cap.read()` tuần tự nên hình trễ dần | Viết lại (mục 6.6) |
| `ai-pipeline/src/inference.py` | **Bug 1:** không đổi BGR → RGB trước khi đưa vào model. **Bug 2:** truyền box dạng `x1,y1,x2,y2` cho `cv2.dnn.NMSBoxes` trong khi hàm này nhận `x,y,w,h`. Ngoài ra `CLASS_NAMES` hard-code, số luồng cố định 4 | Sửa 4 chỗ (mục 6.3) |
| `ai-pipeline/src/alert_publisher.py` | Payload thiếu `deviceId` → backend từ chối | Không dùng trong đợt này (thiên địch ngoài phạm vi) |
| `ai-pipeline/requirements.txt` | Yêu cầu build ByteTrack từ source (`cython`, `lap`) | Thay bằng `supervision` |
| `backend/src/mqtt/handlers/birdCount.handler.ts` | Stub chỉ log | Gọi service mới |
| `backend/src/services/device.service.ts` (`recordHeartbeat`) | Chỉ tra `SensorNode` → CameraNode không bao giờ ONLINE | Thêm nhánh CameraNode |
| `backend/src/services/analytics.service.ts` (`getBirdCountDaily`) | `return_rate` lấy `$avg` trên mọi bản ghi trong ngày | Không cần sửa nếu chỉ bản ghi phiên chiều có `return_rate` |
| `backend/src/services/device.service.ts` (`listCameraNodes`) | Trả nguyên document, gồm `rtsp_url` chứa mật khẩu camera | Loại `rtsp_url` khỏi response |
| `frontend/.../vision/LiveCameraCard.tsx` | Mock: 2 ô xanh giả, nhãn "1080p @ 60fps" giả | Nối stream thật |
| `frontend/src/lib/socket.ts` | Chưa có subscriber `BIRD_COUNT_UPDATE` | Thêm `onBirdCountUpdate` |
| `frontend/.../FarmOwnerLiveStreamPage.tsx` | `ComingSoon` | Dùng lại `LiveCameraCard` hoặc bỏ trang |

SRS trước v2.1 ghi VISION-FR-008/009/011 là "✅ Xong", nhưng thực tế chỉ có phần đọc; chưa có đoạn nào ghi `BirdCountRecord` hay tạo alert `LOW_RETURN_RATE`. SRS v2.1 đã sửa cột trạng thái cho đúng (12/10/2026); ở GĐ6 chỉ cần cập nhật lại khi làm xong.

---

## 3. Phần cứng

### 3.1. Danh mục

| Thành phần | Lựa chọn | Chi phí ước lượng | Ghi chú |
|---|---|---|---|
| Máy xử lý (dev) | Laptop của nhóm | 0đ | CPU 4 nhân trở lên, RAM 8 GB |
| Máy xử lý đặt tại nhà yến — **phương án lùi** | Laptop cũ sẵn có; nếu phải mua thì PC văn phòng cũ, i5 đời 6–8, RAM 8 GB | 0đ – khoảng 2,5 triệu | Chỉ cần khi trượt cổng kiểm tra ở mục 19.5 (mục 17.2, 18.7) |
| Máy chủ cloud | VPS Ubuntu, **4 vCPU loại dedicated, 8 GB RAM**, IP công khai, khu vực Singapore | Cần kiểm tra giá: cỡ máy này đắt hơn rõ rệt và có thể dùng gần hết tín dụng sinh viên trong 1–2 tháng | Chạy backend, MongoDB, EMQX, MediaMTX, Caddy **và model đếm chim** (mục 18.4). Cỡ 2 vCPU / 4 GB chỉ đủ khi model chạy trên máy tại nhà yến |
| Tên miền | Tên miền thật | 0đ nếu lấy qua gói sinh viên | Cần để có HTTPS và chứng chỉ cho MQTT/video |
| Internet tại nhà yến | Cáp quang VNPT, IP public; upload từ khoảng 10 Mbps | Cước hằng tháng theo gói | VPS kéo hình thẳng từ camera qua cổng mở trên modem (mục 19) |
| Camera (đã mua) | TP-Link VIGI C320I ống kính 6 mm (2MP, IR 850 nm, RTSP) + bộ cấp PoE TP-Link TL-POE150S | đã mua | Camera chính cho đếm chim; nối dây LAN vào modem, không phụ thuộc Wi-Fi |
| Camera tạm | Điện thoại Android cũ + app IP Webcam | 0đ | Đủ để thu dữ liệu và demo |
| Mạng | Router/switch sẵn có, cáp LAN | — | PC và camera cùng một LAN |
| Lưu clip | Ổ cứng còn trống khoảng 20 GB | — | 1 giờ H.264 1080p ≈ 1–2 GB |

Giá là ước lượng, cần kiểm tra lại khi mua. Cập nhật `docs/hardware/BOM.md` sau khi chốt.

### 3.2. Yêu cầu camera

- Có **RTSP** (kiểm tra trước khi mua; một số camera Wi-Fi giá rẻ phải bật trong app).
- Codec **H.264** (H.265 giải mã bằng CPU tốn hơn nhiều).
- 1080p, 25–30 fps, ống kính cố định (không xoay, không zoom tự động).
- Có IR để dùng lúc chạng vạng (VISION-FR-007). IR **940 nm** không phát ánh đỏ nên an toàn hơn với chim. Camera đã mua (TP-Link VIGI C320I ống kính 6 mm) dùng IR **850 nm**, phát ánh đỏ mờ nhìn thấy được, phải qua cổng kiểm tra 6 ở mục 19.5 trước khi dùng lâu dài.
- Nếu chỉnh được: giảm thời gian phơi sáng (shutter nhanh) để chim bớt nhòe.

### 3.3. Cách lắp — quyết định độ chính xác nhiều hơn model

1. Đặt camera ở **lỗ ra vào thông ra ngoài trời**, không đặt ở lỗ thông tầng bên trong. Trong một phiên chim lượn lên xuống giữa các tầng nhiều lần, nên đếm ở lỗ thông tầng sẽ tính một con nhiều lần.
2. Camera nằm **bên trong nhà yến, lệch sang một bên, nhìn chéo vào lỗ** (khoảng 30–60° so với hướng chim bay qua lỗ). Phía lỗ, chim hiện thành bóng tối trên nền trời sáng nên dễ phát hiện nhất. Không nhìn dọc theo hướng bay: khi đó chim chỉ to dần hoặc nhỏ dần ở giữa hình, không cắt qua vạch đếm nào. Khung hình phải có cả phía ngoài (lỗ) lẫn một khoảng phía trong, để tracker thấy chim vài khung trước và sau khi qua vạch.
3. Khung hình chỉ rộng hơn vùng lỗ và vùng chim tỏa ra một chút. Mỗi con chim nên chiếm **ít nhất 15–20 px** mỗi chiều trong ảnh đưa vào model.
4. Gắn chặt, không rung. Camera xê dịch là phải chỉnh lại ROI và vạch đếm.
5. Không để đèn, loa treo, vật đung đưa (dây, lá) trong khung hình.
6. Vạch đếm đặt sát miệng lỗ, ở chỗ chim đã tách hàng, vuông góc với hướng bay. Nếu clip thật cho thấy chim không cắt vạch rõ ràng, phương án dự phòng là đếm theo vùng: coi miệng lỗ là một vùng; track xuất hiện từ vùng đó là vào, track đi vào vùng đó rồi mất là ra. Phương án này chưa có trong code ở mục 6.4.
7. Camera nhìn vào miệng lỗ gần như theo hướng chim bay (chim chui qua lỗ rồi tỏa đi mọi hướng): dùng **vòng đếm** khép kín quanh miệng lỗ thay cho một vạch. Chim đi vào vòng là chui vào lỗ, đi ra khỏi vòng là chui ra; con chỉ bay lướt qua lỗ cắt vòng hai lần, số ròng triệt tiêu. Đã có trong code (`src/counting.py`, `RingCounter`), đang dùng ở nhà yến thử nghiệm (mục 19.8).

Vị trí đã lắp thực tế ở nhà yến thử nghiệm: mục 19.7, đổi góc ngày 21/10/2026 ở mục 19.8.

### 3.4. Kiểm tra camera trước khi làm tiếp

```powershell
# Xem thử luồng RTSP (cần cài ffmpeg: winget install Gyan.FFmpeg)
ffplay -rtsp_transport tcp "rtsp://USER:PASS@192.168.1.64:554/stream1"
```

Xong khi: xem được hình, độ trễ dưới khoảng 1 giây, không vỡ hình.

---

## 4. Phần mềm và môi trường

| Nơi chạy | Phần mềm |
|---|---|
| PC Edge AI | **Python 3.11–3.12** (`onnxruntime` 1.30 cần ≥ 3.11), ffmpeg, các gói trong `ai-pipeline/requirements.txt` |
| Colab (train) | `ultralytics==8.4.170` (kéo theo torch), GPU T4 miễn phí |
| Gán nhãn | Roboflow (web) hoặc CVAT |
| Backend/Frontend (dev) | Như hiện tại (`docker compose up -d mongodb emqx`, `npm run dev`) |
| Cloud | Docker + Docker Compose; Caddy, MediaMTX, EMQX, MongoDB, backend (mục 15) |

`ai-pipeline/requirements.txt` mới:

```text
opencv-python>=4.14,<5          # 5.x mới ra 07/2026, chưa dùng
numpy>=1.26,<3
onnxruntime>=1.30,<1.31         # máy chạy CPU Intel: thay bằng onnxruntime-openvino>=1.24.1,<1.25 (mục 18.4)
supervision>=0.30.9,<0.31       # ByteTrack, LineZone; 0.31 mới ra 16/10/2026
paho-mqtt>=2.0,<3
PyYAML>=6.0,<7
python-dotenv>=1.0,<2
loguru>=0.7,<1
pytest>=8,<9
```

**Phiên bản đã chốt (20/10/2026).** Chỉ chọn bản đã phát hành ít nhất 2 tuần: bản mới hơn chưa có thời gian lộ lỗi. Cận trên khóa trong cùng nhánh phát hành, nên `pip install` chỉ nhận bản vá, không tự nhảy lên bản có thể đổi API giữa lúc đang test.

| Gói | Bản dùng | Ghi chú |
|---|---|---|
| Python | 3.11 (Docker `python:3.11-slim`) hoặc 3.12 | `onnxruntime` 1.30 và `onnxruntime-openvino` 1.24 không có bản cho 3.10 |
| `ultralytics` (chỉ dùng trên Colab) | **8.4.170** (30/09/2026) | Có YOLOv8, YOLO11, YOLO26. Hầu như ngày nào cũng ra bản mới, nên ghim đúng một bản cho mọi lượt train để kết quả so sánh được |
| `onnxruntime` | 1.30.x (10/09/2026) | 1.31 ra 09/10/2026, chưa dùng |
| `onnxruntime-openvino` | 1.24.1 (26/02/2026) | Chỉ cho CPU Intel |
| `supervision` | 0.30.9 (08/10/2026) | Bản vá cuối của nhánh 0.30 |
| `opencv-python` | 4.14.x | |

Khi muốn nâng phiên bản: nâng từng gói một, chạy lại `pytest` và một clip test (mục 7.9). Số đếm không đổi thì mới giữ bản mới.

Cài đặt:

```powershell
cd ai-pipeline
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Cấu trúc thư mục sau khi làm xong:

```
ai-pipeline/
  config/config.yaml
  .env                    # không commit: RTSP URL, MQTT, ID farm/house/zone/device
  models/                 # không commit: swiftlet_v1.onnx
  src/
    inference.py          # giữ, sửa 4 chỗ
    counting.py           # viết lại
    mjpeg_server.py       # mới
    stream.py             # viết lại
  tools/
    extract_frames.py     # mới — tách frame + nhãn nháp
    split_by_day.py       # mới — chia train/val/test theo ngày
  tests/test_counting.py  # mới
  clips/  dataset/        # không commit
```

Thêm vào `.gitignore`: `ai-pipeline/models/`, `ai-pipeline/clips/`, `ai-pipeline/dataset/`, `ai-pipeline/.env`, `ai-pipeline/logs/`, `ai-pipeline/state.json`.

---

## 5. GĐ0 — Chuẩn bị

Thời gian: 0,5 ngày.

1. Lắp camera theo mục 3.3, kiểm tra RTSP theo mục 3.4.
2. Quay 2–3 clip 5 phút để dev (lệnh ở mục 7.1).
3. Chạy `npm run seed` (nếu DB trống), đăng ký CameraNode:

```http
POST /devices/camera-nodes/register
Authorization: Bearer <token của TECHNICIAN hoặc ADMIN>

{ "device_id": "cam-house1-01", "house_id": "<ObjectId của House>", "secret_key": "<khóa>" }
```

4. Ghi lại `farmId`, `houseId`, `device_id` vào `ai-pipeline/.env` (SRS v2.1.8: camera ở cửa ra vào của cả nhà yến nên gắn House, không có Zone):

```dotenv
CAMERA_RTSP_URL=rtsp://USER:PASS@192.168.1.64:554/stream1
CAMERA_DEVICE_ID=cam-zone1-01
FARM_ID=...
HOUSE_ID=...
MQTT_USERNAME=
MQTT_PASSWORD=
# Chỉ điền khi chạy với cloud (mục 15); để trống khi dev trên máy
STREAM_PUSH_URL=rtsps://pipeline:<STREAM_PUBLISH_SECRET>@<tên miền>:8322/cam-cam-zone1-01
```

**Xong khi:** có clip thật, có CameraNode trong DB, `.env` đủ giá trị.

---

## 6. GĐ1 — Pipeline đếm + ô xanh

Thời gian: 2 ngày. Mục tiêu: chạy được trên clip, mở trình duyệt thấy ô xanh và số đếm.

### 6.1. Model tạm để thử đường ống

Chưa có model riêng thì dùng YOLO26n pretrained (COCO, class `bird` = 14). Export một lần trên Colab:

```python
!pip install -q "ultralytics==8.4.170"    # ghim bản, xem mục 4
from ultralytics import YOLO
YOLO("yolo26n.pt").export(format="onnx", imgsz=640, nms=False, simplify=True)
# tải yolo26n.onnx về ai-pipeline/models/
```

`nms=False` xuất đầu ra không cần NMS: mảng `(1, 300, 6)`, mỗi dòng là `[x1, y1, x2, y2, confidence, class_id]` theo tọa độ ảnh đầu vào đã letterbox. Không có `nms=False` thì file ONNX ra định dạng cũ `(1, 84, 8400)` và phải tự chạy NMS. `inference.py` ở mục 6.3 đọc định dạng mới. Nếu `onnxruntime` báo không hỗ trợ opset, export lại với `opset=17`.

Vì sao chọn YOLO26n (tra cứu 20/10/2026):

| Model | mAP COCO 50-95 | CPU ONNX, đầu vào 640 | Ghi chú |
|---|---|---|---|
| YOLOv8n | 37,3 | 80,4 ms | Bản trong SRS cũ |
| YOLO11n | 39,5 | 56,1 ms | |
| **YOLO26n** | **40,9** (40,1 khi không dùng NMS) | **38,9 ms** | Ra mắt 14/01/2026. Bỏ NMS, thêm STAL (gán nhãn có lợi cho vật thể nhỏ). Ultralytics khuyên dùng cho dự án hiện tại |

Số liệu là của Ultralytics, đo trên Intel Xeon 2,0 GHz, chưa có nhóm độc lập nào đo lại. YOLO27 đã công bố ở YOLO Vision 2026 nhưng chưa phát hành trọng số. Khi có, chỉ cần đổi tên model rồi train lại theo mục 7.5. Cách train, định dạng nhãn và giấy phép (AGPL-3.0) của YOLO26 giống YOLOv8.

Model này bắt sót nhiều chim yến (nhỏ, nhòe). Nó chỉ dùng để kiểm tra đường ống, không dùng để báo cáo số liệu.

### 6.2. `config/config.yaml`

```yaml
camera:
  source: "clips/20261008_morning_01.mp4"   # bị CAMERA_RTSP_URL trong .env ghi đè khi chạy thật
  fps: 25
  roi: [0.20, 0.10, 0.85, 0.80]             # x1,y1,x2,y2 theo tỉ lệ khung hình — vùng quanh lỗ ra vào

model:
  path: "models/yolo26n.onnx"               # đổi thành models/swiftlet_v1.onnx sau GĐ2
  version: "yolo26n-coco"
  input_size: 640                           # phải bằng imgsz lúc export; hạ 480/416 nếu thiếu FPS (mục 18.4)
  confidence_threshold: 0.30
  nms_iou_threshold: 0.45                   # chỉ dùng với YOLOv8n/YOLO11n; YOLO26n export nms=False không cần NMS
  providers: ["CPUExecutionProvider"]       # CPU Intel + onnxruntime-openvino: ["OpenVINOExecutionProvider", "CPUExecutionProvider"]
  classes:
    14: swiftlet                            # COCO bird. Model tự train: đổi thành  0: swiftlet

tracking:
  line: [0.20, 0.45, 0.85, 0.45]            # 2 điểm của vạch đếm, theo tỉ lệ khung hình
  in_is_entry: true                         # đếm ngược chiều thì đổi thành false
  box_pad: 2.5                              # nới box trước khi track (chim nhỏ bay nhanh)
  lost_track_buffer: 15
  minimum_matching_threshold: 0.8

sessions:                                   # giờ chim bay đổi theo mùa: xem lại khung giờ bằng biểu đồ số đếm 5 phút
  MORNING_EXIT:  ["05:30", "07:00"]
  EVENING_ENTRY: ["17:30", "19:00"]

mqtt:
  broker: "localhost"                       # cloud: tên miền của VPS
  port: 1883                                # cloud: 8883
  tls: false                                # cloud: true
  publish_interval_sec: 30
  bucket_minutes: 5                         # số đếm theo khoảng thời gian, gửi cả ngoài phiên (VISION-FR-017)

push:                                       # đẩy video lên MediaMTX; chỉ chạy khi có STREAM_PUSH_URL trong .env
  width: 1280
  height: 720
  fps: 15
  bitrate: "1500k"

stream:
  host: "127.0.0.1"                         # MJPEG chỉ mở cho chính máy này, để hiệu chỉnh; người xem từ xa đi qua MediaMTX
  port: 8090
  jpeg_quality: 70

logging:
  file: "logs/pipeline.log"
  rotation: "10 MB"
```

### 6.3. Sửa `src/inference.py`

Bốn chỗ. Chỗ 4 viết lại cả `postprocess` để đọc được **cả hai kiểu đầu ra**: YOLO26n export `nms=False` (không cần NMS) và YOLOv8n/YOLO11n (phải chạy NMS). Nhờ vậy, đổi model để so sánh (mục 7.9) chỉ cần sửa `model.path` trong config, không phải sửa code:

```python
# 1) __init__: nhận tên class và provider từ config, số luồng theo máy
def __init__(self, model_path, input_size=640, conf_threshold=0.5, iou_threshold=0.45,
             class_names=None, providers=None):
    self.class_names = class_names or {0: "swiftlet"}
    ...
    sess_opts.intra_op_num_threads = os.cpu_count() or 4      # thêm `import os`
    self.session = ort.InferenceSession(model_path, sess_opts,
                                        providers=providers or ["CPUExecutionProvider"])
    logger.info(f"Model loaded: {model_path} | providers: {self.session.get_providers()}")

# 2) preprocess: model train bằng ảnh RGB, OpenCV đọc ra BGR
blob = padded[:, :, ::-1].astype(np.float32) / 255.0

# 3) preprocess trả về (blob, scale, pad_x, pad_y); infer() gọi postprocess(outputs, scale, pad_x, pad_y)

# 4) postprocess: nhận kiểu đầu ra theo shape
def postprocess(self, outputs, scale, pad_x, pad_y):
    out = outputs[0][0]
    end2end = out.shape[1] == 6                  # YOLO26 nms=False: (300, 6); YOLOv8/11: (4 + số class, 8400)
    if end2end:                                  # mỗi dòng: x1, y1, x2, y2, confidence, class_id
        xyxy, conf, cls = out[:, :4], out[:, 4], out[:, 5].astype(int)
    else:                                        # mỗi cột: cx, cy, w, h, điểm của từng class
        out = out.T
        cls = out[:, 4:].argmax(axis=1)
        conf = out[np.arange(len(out)), 4 + cls]
        cx, cy, w, h = out[:, 0], out[:, 1], out[:, 2], out[:, 3]
        xyxy = np.stack([cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2], axis=1)
    keep = (conf >= self.conf_thresh) & np.isin(cls, list(self.class_names))
    xyxy, conf, cls = xyxy[keep], conf[keep], cls[keep]
    if not end2end and len(xyxy):                # cv2.dnn.NMSBoxes nhận [x, y, w, h]
        xywh = np.concatenate([xyxy[:, :2], xyxy[:, 2:] - xyxy[:, :2]], axis=1)
        idx = np.array(cv2.dnn.NMSBoxes(xywh.tolist(), conf.tolist(),
                                        self.conf_thresh, self.iou_thresh)).reshape(-1)
        xyxy, conf, cls = xyxy[idx], conf[idx], cls[idx]
    xyxy = (xyxy - [pad_x, pad_y, pad_x, pad_y]) / scale      # bỏ viền letterbox, về tọa độ ROI
    return [Detection(int(c), self.class_names[int(c)], float(p), tuple(map(int, b)))
            for b, p, c in zip(xyxy, conf, cls)]
```

Xóa hằng `CLASS_NAMES`/`PREDATOR_IDS`. `confidence_threshold` dùng cho mọi model, `nms_iou_threshold` chỉ có tác dụng với YOLOv8n/YOLO11n.

Với YOLO26n cũng có thể export đầu ra kiểu cũ (bỏ `nms=False`; trên COCO chính xác hơn khoảng 0,8 mAP nhưng phải chạy NMS). Code trên tự nhận ra kiểu đó. Chỉ chọn cách này khi so trên cùng tập test (mục 7.9) thấy đáng.

### 6.4. `src/counting.py` (viết lại)

> **Đã làm theo góc camera ngày 21/10/2026 (mục 19.8):** `src/counting.py` là `RingCounter` — vòng đếm khép kín (`tracking.ring`, chiều `tracking.into_ring_is_exit`), không phải `LineCounter` bên dưới. Nhận `tracker_id` và `xyxy` dạng mảng nên dùng thẳng với `sv.Detections` (`counter.update(tracks.tracker_id, tracks.xyxy)`). Code mẫu bên dưới giữ cho trường hợp camera nhìn ngang lỗ, nơi một vạch là đủ.

```python
"""SwiftletCare – đếm chim qua vạch ảo (VISION-FR-005)."""
import supervision as sv


class LineCounter:
    """Bọc sv.LineZone: vạch 2 điểm bất kỳ, ánh xạ chiều in/out sang ENTRY/EXIT."""

    def __init__(self, line, width, height, in_is_entry=True, base_entry=0, base_exit=0):
        x1, y1, x2, y2 = line
        self.start = sv.Point(int(x1 * width), int(y1 * height))
        self.end = sv.Point(int(x2 * width), int(y2 * height))
        self._zone = sv.LineZone(start=self.start, end=self.end,
                                 triggering_anchors=[sv.Position.CENTER])
        self._in_is_entry = in_is_entry
        self._base = (base_entry, base_exit)   # số đã đếm trước khi pipeline khởi động lại

    def update(self, tracks: sv.Detections) -> None:
        if tracks.tracker_id is not None and len(tracks):
            self._zone.trigger(tracks)

    @property
    def entry_count(self) -> int:
        n = self._zone.in_count if self._in_is_entry else self._zone.out_count
        return self._base[0] + n

    @property
    def exit_count(self) -> int:
        n = self._zone.out_count if self._in_is_entry else self._zone.in_count
        return self._base[1] + n
```

### 6.5. `src/mjpeg_server.py` (mới)

```python
"""SwiftletCare – phát frame đã vẽ khung dưới dạng MJPEG (VISION-FR-013/014).

GET /stream           → có ô xanh
GET /stream?boxes=0   → hình gốc
"""
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import cv2


class MjpegServer:
    def __init__(self, host: str, port: int, quality: int = 70):
        self._jpeg = {}                       # "1": có box, "0": không box
        self._cond = threading.Condition()
        self._params = [cv2.IMWRITE_JPEG_QUALITY, quality]
        outer = self

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                if not self.path.startswith("/stream"):
                    self.send_error(404)
                    return
                key = "0" if "boxes=0" in self.path else "1"
                self.send_response(200)
                self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=frame")
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                try:
                    while True:
                        with outer._cond:
                            outer._cond.wait(timeout=5)
                            jpg = outer._jpeg.get(key)
                        if jpg is None:
                            continue
                        self.wfile.write(b"--frame\r\nContent-Type: image/jpeg\r\n"
                                         b"Content-Length: %d\r\n\r\n" % len(jpg))
                        self.wfile.write(jpg + b"\r\n")
                except ConnectionError:       # người xem đóng tab
                    pass

            def log_message(self, *args):     # không ghi log mỗi request
                pass

        self._httpd = ThreadingHTTPServer((host, port), Handler)
        threading.Thread(target=self._httpd.serve_forever, daemon=True).start()

    def publish(self, annotated, raw) -> None:
        # ponytail: nén cả 2 bản mỗi frame; nếu thiếu CPU thì chỉ nén bản đang có người xem
        ok1, a = cv2.imencode(".jpg", annotated, self._params)
        ok0, r = cv2.imencode(".jpg", raw, self._params)
        with self._cond:
            if ok1:
                self._jpeg["1"] = a.tobytes()
            if ok0:
                self._jpeg["0"] = r.tobytes()
            self._cond.notify_all()
```

### 6.6. `src/stream.py` (viết lại)

```python
"""SwiftletCare – pipeline đếm chim.
RTSP/file → YOLO (ONNX) → ByteTrack → vạch đếm → MJPEG + MQTT

Chạy thật:      python src/stream.py
Chạy trên clip: python src/stream.py --source clips/x.mp4 --session MORNING_EXIT
SRS: VISION-FR-001..006, 012..014
"""
import argparse
import json
import os
import threading
import time
from datetime import datetime
from pathlib import Path

import cv2
import numpy as np
import paho.mqtt.client as mqtt
import supervision as sv
import yaml
from dotenv import load_dotenv
from loguru import logger

from counting import LineCounter
from inference import InferenceEngine
from mjpeg_server import MjpegServer

STATE_FILE = Path("state.json")
GREEN = (0, 255, 0)


# ── Nguồn hình ───────────────────────────────────────────────────────────────
class FrameGrabber(threading.Thread):
    """Đọc RTSP liên tục, chỉ giữ frame mới nhất để hình không trễ dần."""

    def __init__(self, source: str):
        super().__init__(daemon=True)
        self.source, self.frame, self.seq = source, None, 0
        self.lock = threading.Lock()

    def run(self):
        os.environ.setdefault("OPENCV_FFMPEG_CAPTURE_OPTIONS", "rtsp_transport;tcp")
        cap = cv2.VideoCapture(self.source)
        while True:
            ok, frame = cap.read()
            if not ok:
                logger.warning("Mất luồng camera, kết nối lại sau 2 giây")
                cap.release()
                time.sleep(2)
                cap = cv2.VideoCapture(self.source)
                continue
            with self.lock:
                self.frame, self.seq = frame, self.seq + 1


def frames(source: str, live: bool):
    """Live: luôn trả frame mới nhất. File: trả đủ từng frame (để đo độ chính xác)."""
    if not live:
        cap = cv2.VideoCapture(source)
        if not cap.isOpened():
            raise SystemExit(f"Không mở được {source}")
        while True:
            ok, frame = cap.read()
            if not ok:
                return
            yield frame
    grabber = FrameGrabber(source)
    grabber.start()
    last = 0
    while True:
        with grabber.lock:
            frame, seq = grabber.frame, grabber.seq
        if frame is None or seq == last:
            time.sleep(0.002)
            continue
        last = seq
        yield frame


# ── Tiện ích ─────────────────────────────────────────────────────────────────
def current_session(sessions: dict, now: datetime):
    hhmm = now.strftime("%H:%M")
    for name, (start, end) in sessions.items():
        if start <= hhmm < end:
            return name
    return None


def scale_boxes(xyxy: np.ndarray, k: float) -> np.ndarray:
    """Phóng/thu box quanh tâm. Chim nhỏ bay nhanh → 2 box liên tiếp không chồng nhau,
    ByteTrack (ghép theo IoU) sẽ mất dấu nếu không nới box."""
    center = (xyxy[:, :2] + xyxy[:, 2:]) / 2
    half = (xyxy[:, 2:] - xyxy[:, :2]) / 2 * k
    return np.hstack([center - half, center + half]).astype(np.float32)


def to_sv(dets, offset) -> sv.Detections:
    if not dets:
        return sv.Detections.empty()
    ox, oy = offset
    xyxy = np.array([d.bbox for d in dets], dtype=np.float32) + [ox, oy, ox, oy]
    return sv.Detections(
        xyxy=xyxy.astype(np.float32),
        confidence=np.array([d.confidence for d in dets], dtype=np.float32),
        class_id=np.array([d.class_id for d in dets], dtype=int),
    )


def load_state(session: str):
    """Số đã đếm của đúng phiên + ngày hôm nay, để khởi động lại giữa phiên không mất số."""
    try:
        s = json.loads(STATE_FILE.read_text())
        if s["session"] == session and s["date"] == datetime.now().strftime("%Y-%m-%d"):
            return s["entry"], s["exit"]
    except (OSError, ValueError, KeyError):
        pass
    return 0, 0


def save_state(session: str, counter: LineCounter) -> None:
    STATE_FILE.write_text(json.dumps({
        "session": session, "date": datetime.now().strftime("%Y-%m-%d"),
        "entry": counter.entry_count, "exit": counter.exit_count,
    }))


def draw(frame, tracks: sv.Detections, counter: LineCounter, roi, fps: float, session):
    x1, y1, x2, y2 = roi
    cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 255, 255), 1)                 # vùng ROI
    cv2.line(frame, (counter.start.x, counter.start.y), (counter.end.x, counter.end.y),
             (0, 255, 255), 2)                                                   # vạch đếm
    ids = tracks.tracker_id if tracks.tracker_id is not None else []
    for box, tid in zip(tracks.xyxy.astype(int), ids):
        cv2.rectangle(frame, (box[0], box[1]), (box[2], box[3]), GREEN, 2)       # ô xanh
        cv2.putText(frame, f"#{tid}", (box[0], box[1] - 4),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.45, GREEN, 1)
    text = f"VAO {counter.entry_count}  RA {counter.exit_count}  {fps:.0f} FPS  {session or 'ngoai phien'}"
    cv2.putText(frame, text, (10, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 0), 4)
    cv2.putText(frame, text, (10, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
    return frame


# ── MQTT ─────────────────────────────────────────────────────────────────────
class Publisher:
    def __init__(self, cfg: dict, model_version: str):
        self.device_id = os.environ["CAMERA_DEVICE_ID"]
        self.model_version = model_version
        base = f"swiftletcare/{os.environ['FARM_ID']}/{os.environ['HOUSE_ID']}"   # SRS v2.1.8: topic theo nhà yến
        self.topic_count = f"{base}/vision/bird-count"
        self.topic_heartbeat = f"{base}/heartbeat"
        self.client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=self.device_id)
        if cfg.get("tls"):                       # cloud: chứng chỉ Let's Encrypt, dùng CA có sẵn của hệ điều hành
            self.client.tls_set()
        if os.getenv("MQTT_USERNAME"):
            self.client.username_pw_set(os.environ["MQTT_USERNAME"], os.getenv("MQTT_PASSWORD"))
        self.client.connect_async(cfg["broker"], cfg["port"])   # tự kết nối lại khi rớt
        self.client.loop_start()

    def bird_count(self, session, counter: LineCounter, conf_avg: float, final=False):
        self.client.publish(self.topic_count, json.dumps({
            "deviceId": self.device_id,
            "session_type": session,
            "entry_count": counter.entry_count,
            "exit_count": counter.exit_count,
            "confidence_avg": round(conf_avg, 3),
            "final": final,                      # true = phiên vừa kết thúc
            "timestamp": int(time.time() * 1000),
        }), qos=1)

    def bucket(self, start_ts: float, minutes: int, entry: int, exit_: int):
        """VISION-FR-017 — số chim qua vạch trong một khoảng thời gian, gửi cả ngoài phiên."""
        self.client.publish(self.topic_count, json.dumps({
            "deviceId": self.device_id, "kind": "BUCKET",
            "bucket_start": int(start_ts * 1000), "bucket_minutes": minutes,
            "entry_count": entry, "exit_count": exit_,
            "timestamp": int(time.time() * 1000),
        }), qos=1)

    def heartbeat(self):
        self.client.publish(self.topic_heartbeat, json.dumps({
            "deviceId": self.device_id, "firmwareVersion": self.model_version,
        }), qos=0)


# ── Vòng lặp chính ───────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default="config/config.yaml")
    ap.add_argument("--source", help="ghi đè nguồn hình (file hoặc rtsp://)")
    ap.add_argument("--session", choices=["MORNING_EXIT", "EVENING_ENTRY"],
                    help="ép phiên khi chạy trên clip")
    ap.add_argument("--no-mqtt", action="store_true")
    args = ap.parse_args()

    load_dotenv()
    cfg = yaml.safe_load(open(args.config, encoding="utf-8"))
    logger.add(cfg["logging"]["file"], rotation=cfg["logging"]["rotation"])

    source = args.source or os.getenv("CAMERA_RTSP_URL") or cfg["camera"]["source"]
    live = str(source).startswith(("rtsp://", "http://"))
    m, t = cfg["model"], cfg["tracking"]

    engine = InferenceEngine(m["path"], m["input_size"], m["confidence_threshold"],
                             m["nms_iou_threshold"], class_names=m["classes"], providers=m["providers"])
    server = MjpegServer(cfg["stream"]["host"], cfg["stream"]["port"], cfg["stream"]["jpeg_quality"])
    pub = None if args.no_mqtt else Publisher(cfg["mqtt"], m["version"])

    # Tracker sống suốt chương trình (không tạo lại khi đổi phiên) để ID không lặp lại:
    # bộ đếm cả ngày bên dưới nhớ trạng thái theo ID.
    tracker = sv.ByteTrack(frame_rate=cfg["camera"]["fps"],
                           lost_track_buffer=t["lost_track_buffer"],
                           minimum_matching_threshold=t["minimum_matching_threshold"])
    session = counter = day_counter = None     # day_counter: đếm liên tục, làm nguồn cho số đếm 5 phút
    bucket_len = cfg["mqtt"]["bucket_minutes"] * 60
    bucket_start = time.time() // bucket_len * bucket_len
    bucket_base = (0, 0)
    started = False
    conf_sum = conf_n = 0.0
    last_pub = last_log = time.time()
    n_frames, fps = 0, 0.0

    for frame in frames(source, live):
        h, w = frame.shape[:2]
        now_session = args.session or current_session(cfg["sessions"], datetime.now())

        if not started or now_session != session:            # bắt đầu hoặc đổi phiên
            if pub and session:
                pub.bird_count(session, counter, conf_sum / max(conf_n, 1), final=True)
            session, started = now_session, True
            base = load_state(session) if session and live else (0, 0)
            counter = LineCounter(t["line"], w, h, t["in_is_entry"], *base)
            if day_counter is None:
                day_counter = LineCounter(t["line"], w, h, t["in_is_entry"])
            conf_sum = conf_n = 0.0
            logger.info(f"Phiên: {session or 'ngoài phiên'}")

        rx1, ry1, rx2, ry2 = (int(cfg["camera"]["roi"][i] * (w, h)[i % 2]) for i in range(4))
        dets, _ = engine.infer(frame[ry1:ry2, rx1:rx2])
        det = to_sv(dets, (rx1, ry1))
        if len(det):
            conf_sum += float(det.confidence.sum())
            conf_n += len(det)
            det.xyxy = scale_boxes(det.xyxy, t["box_pad"])
        tracks = tracker.update_with_detections(det)
        counter.update(tracks)
        day_counter.update(tracks)
        if len(tracks):
            tracks.xyxy = scale_boxes(tracks.xyxy, 1 / t["box_pad"])   # vẽ box kích thước thật

        server.publish(draw(frame.copy(), tracks, counter, (rx1, ry1, rx2, ry2), fps, session), frame)

        n_frames += 1
        now = time.time()
        if now - last_log >= 5:
            fps = n_frames / (now - last_log)
            logger.info(f"{fps:.1f} FPS | track {len(tracks)} | vào {counter.entry_count} ra {counter.exit_count}")
            n_frames, last_log = 0, now
        if now - last_pub >= cfg["mqtt"]["publish_interval_sec"]:
            last_pub = now
            if pub:
                pub.heartbeat()
                if session:
                    pub.bird_count(session, counter, conf_sum / max(conf_n, 1))
            if session and live:
                save_state(session, counter)
        if live and now >= bucket_start + bucket_len:           # hết một khoảng 5 phút
            total = (day_counter.entry_count, day_counter.exit_count)
            if pub:
                pub.bucket(bucket_start, cfg["mqtt"]["bucket_minutes"],
                           total[0] - bucket_base[0], total[1] - bucket_base[1])
            bucket_base, bucket_start = total, now // bucket_len * bucket_len

    # chỉ tới đây khi chạy trên file
    logger.info(f"KẾT QUẢ: vào {counter.entry_count} | ra {counter.exit_count}")
    if pub and session:
        pub.bird_count(session, counter, conf_sum / max(conf_n, 1), final=True)
        time.sleep(1)                                        # chờ gửi xong tin cuối


if __name__ == "__main__":
    main()
```

### 6.7. `tests/test_counting.py` (mới)

```python
import sys

import numpy as np
import supervision as sv

sys.path.insert(0, "src")
from counting import LineCounter   # noqa: E402


def _track(cy: float) -> sv.Detections:
    return sv.Detections(xyxy=np.array([[90, cy - 10, 110, cy + 10]], dtype=np.float32),
                         confidence=np.array([0.9], dtype=np.float32),
                         class_id=np.array([0]), tracker_id=np.array([1]))


def _run(counter, ys):
    for y in ys:
        counter.update(_track(y))


def test_crossing_counted_once_per_direction():
    c = LineCounter([0.0, 0.5, 1.0, 0.5], 200, 200)        # vạch ngang giữa khung 200x200
    _run(c, [40, 60, 80, 120, 140, 160])                   # đi từ trên xuống
    assert c.entry_count + c.exit_count == 1
    first_was_entry = c.entry_count == 1
    _run(c, [140, 120, 80, 60, 40])                        # quay ngược lại
    assert (c.entry_count, c.exit_count) == (1, 1)

    flipped = LineCounter([0.0, 0.5, 1.0, 0.5], 200, 200, in_is_entry=False)
    _run(flipped, [40, 60, 80, 120, 140, 160])
    assert (flipped.entry_count == 1) != first_was_entry   # đổi cờ thì đổi chiều


def test_base_counts_survive_restart():
    c = LineCounter([0.0, 0.5, 1.0, 0.5], 200, 200, base_entry=7, base_exit=3)
    assert (c.entry_count, c.exit_count) == (7, 3)
```

Chạy: `pytest tests/`.

### 6.8. Chạy thử và hiệu chỉnh

```powershell
python src/stream.py --source clips/20261008_morning_01.mp4 --session MORNING_EXIT --no-mqtt
# mở http://127.0.0.1:8090/stream trong trình duyệt
```

Trình tự hiệu chỉnh (sửa `config.yaml` rồi chạy lại):

0. **Đo trên clip có chim** (mở clip, click bằng `tools/pick_roi.py` để đọc pixel): **s** = cỡ một con chim sát miệng lỗ, **v** = quãng nó bay giữa hai khung liên tiếp.
1. **Vòng đếm** (vòng vàng): `python tools/pick_roi.py <ảnh|clip|rtsp> --margin <d>`, click lần lượt các góc viền ngoài miệng lỗ, Enter in ra khối YAML `ring`. `d = max(s, 1,5 × v)`: chim vừa chui ra phải nằm *trong* vòng ít nhất 1–2 khung trước khi cắt vòng, nếu không tracker chưa kịp có id và con đó bị sót.
2. **Vùng theo dõi**: cả khung, chia 2 ô `camera.tiles`, tô đen dòng ngày giờ `camera.mask` (mục 19.8). Mỗi ô thu về đầu vào model phải giữ chim ≥ 15 px (cổng 5). Xem ô xanh bằng `python tools/track_clip.py <clip> --start <giây> --seconds 20` (thêm `--detector motion` khi chưa có model tự train).
3. **Chiều đếm**: nếu chim chui ra khỏi lỗ mà số "RA" tăng thì đổi `into_ring_is_exit` (vạch thẳng: `in_is_entry`).
4. **`box_pad`**: nếu `#id` nhảy số liên tục trên cùng một con, tăng dần 2.5 → 3 → 4.
5. **`confidence_threshold`**: hạ nếu sót nhiều, tăng nếu bắt nhầm.

**Xong khi:**
- `pytest` qua.
- Thấy ô xanh bám theo chim và số đếm tăng khi chim qua vạch.
- FPS xử lý trong log ≥ tốc độ khung hình của camera (**25** với VIGI C320I, đã kiểm tra 20/10/2026), đo trên máy sẽ chạy thật — với kiến trúc đã chốt là VPS (cổng 1, mục 19.5). SRS v2.1 (PERF-NFR-004) chỉ yêu cầu kịp luồng camera, không còn con số 25 cố định. Nếu không đạt, xem mục 13 và 18.4.

---

## 7. GĐ2 — Thu dữ liệu, gán nhãn, train model

Thời gian: 5–7 ngày, chạy song song với GĐ3–GĐ4. Đây là phần quyết định độ chính xác.

### 7.1. Thu clip từ camera

Quy ước tên file: `YYYYMMDD_<phiên>_<số>.mp4`. Ngày ở đầu tên được dùng để chia tập dữ liệu.

```powershell
# Ghi 30 phút, sao chép nguyên luồng (không nén lại, không mất chất lượng)
ffmpeg -rtsp_transport tcp -i "rtsp://USER:PASS@192.168.1.64:554/stream1" -c copy -t 1800 clips/20261008_morning_01.mp4
```

Kế hoạch thu:

| Yêu cầu | Lý do |
|---|---|
| Ít nhất **4 ngày khác nhau** | 2 ngày train, 1 ngày val, 1 ngày test |
| Cả phiên sáng (05:30–07:00) và chiều (17:30–19:00) | Ánh sáng và hướng bay khác nhau |
| Có ngày nắng, ngày âm u/mưa nếu được | Model không học thuộc một kiểu nền |
| Tổng 2–4 giờ clip | Đủ để rút 1.500–3.000 frame có chim |
| Giữ nguyên vị trí camera | Dữ liệu train phải giống lúc chạy thật |

**Đã đặt từ 21/10/2026** trên laptop của nhóm: Task Scheduler (`\SwiftletCare\`) đánh thức máy lúc 05:15 và 17:15, chạy `D:\SwiftletCare\record_session.ps1` quay tới 07:15 / 19:15 vào `D:\SwiftletCare\clips\YYYYMMDD_<morning|evening>_NN.mp4` (`ffmpeg -c copy` ra `.part.mp4` dạng fragmented để file bị ngắt vẫn xem được, quay xong tự đóng gói lại thành mp4 thường `-movflags +faststart` vì fragmented mp4 không có chỉ mục nên không tua được; log ở `D:\SwiftletCare\logs\record.log`). Lần đầu chạy thật 22/10/2026: máy ngủ vẫn tự thức lúc 05:15 và quay đủ 2 giờ. Máy phải cắm sạc: wake timer chỉ bật khi dùng nguồn điện. Clip, frame và dataset để ở ổ D, không để trong repo (`ai-pipeline/clips` là junction trỏ sang `D:\SwiftletCare\clips`, đã gitignore).

**Nguồn dữ liệu là chính camera sẽ dùng thật, tại đúng vị trí lắp thật.** Không dùng điện thoại hay camera khác để thu dữ liệu train: khác ống kính, góc nhìn, độ nhòe và màu thì model học sai thứ. Hai cách lấy clip từ camera, theo thứ tự ưu tiên:

| Cách | Khi nào dùng | Lưu ý |
|---|---|---|
| Ghi qua RTSP bằng lệnh `ffmpeg` ở trên | Laptop kéo được luồng RTSP trong giờ chim bay: tại nhà yến qua LAN, hoặc từ xa qua IP public (mục 16.6) | Tốt nhất: clip giống hệt luồng hình pipeline sẽ nhận khi chạy thật |
| Camera tự ghi vào thẻ microSD | Không có máy tính tại chỗ | Đặt ghi **liên tục** (không phải chỉ khi có chuyển động) và chất lượng cao nhất. File có thể là H.265 hoặc định dạng riêng của hãng; chuyển về MP4 bằng `ffmpeg -i <file gốc> -c:v libx264 -crf 18 <YYYYMMDD_phiên_số>.mp4`. Kiểm tra độ phân giải có trùng luồng RTSP không; nếu khác thì ưu tiên cách trên |
| Tải clip về từ app của hãng trên điện thoại | Chỉ để bổ sung, khi hai cách trên không làm được | Chỉ dùng clip **tải bản gốc** từ thẻ nhớ qua app, không dùng clip quay màn hình hay clip xem lại chất lượng thấp. Kiểm tra bằng `ffprobe <file>`: độ phân giải và fps phải trùng luồng RTSP. Clip sự kiện ngắn (10–30 giây) dùng được để train nhưng không dùng được để đo sai số đếm. Tải khi điện thoại đang ở Wi-Fi nhà yến, vì tải từ xa sẽ kéo video qua 4G |

### 7.2. Tách frame và sinh nhãn nháp — `tools/extract_frames.py`

Camera cố định nên có thể dùng background subtraction để khoanh sẵn vật thể chuyển động. Người gán nhãn chỉ còn sửa và xóa, nhanh hơn vẽ từ đầu nhiều lần. Code: `ai-pipeline/tools/extract_frames.py` (test ở `tests/test_dataset_tools.py`).

```powershell
cd ai-pipeline
Get-ChildItem D:\SwiftletCare\clips\*.mp4 | ForEach-Object { python tools/extract_frames.py $_.FullName --out D:\SwiftletCare\dataset\raw }
```

- **Ảnh cắt theo 2 ô `camera.tiles` và tô đen `camera.mask`** bằng đúng `src/frame_prep.py` mà pipeline dùng: model train trên ảnh nào thì chạy thật trên đúng ảnh đó. Mỗi frame ra `_t0.jpg` và `_t1.jpg`. **Chốt ô và mask trước khi tách frame**; đổi sau đó là phải tách và gán nhãn lại. `--start`/`--seconds` để chỉ tách đoạn có chim.
- Tên clip phải bắt đầu bằng `YYYYMMDD` (dùng để chia tập ở mục 7.4); công cụ từ chối tên khác.
- `--every 5` ở 25 fps = 5 ảnh/giây; ra quá nhiều ảnh gần giống nhau thì tăng lên 10–15.
- `--min-area 150` (px² trong ảnh crop): đo trên clip IR 21/10, nhiễu cảm biến ra đốm 49–108 px² sau dilate (119 ô nháp giả trên clip 90 giây với ngưỡng 30 cũ, còn 8 với 150). Chim ≥ 15 px trong ảnh đầu vào model ≈ 25×25 px trong ô cao 1080 px, nên 150 không bỏ sót chim nào model cần thấy. `--max-area 60000` giữ được chim bay sát ống kính (~180×180 px).
- **Nhãn nháp mặc định lấy từ tracking** (`--draft tracks`): vật chuyển động → ByteTrack trên cả khung như `tools/track_clip.py --detector motion`, chỉ giữ vết sống ≥ 3 frame và dời ≥ 20 px. Đoạn 05:22 ngày 22/10: 159 vết chuyển động còn 22 vết, ô nằm đúng trên chim; xem video thì khoảng 90% chim được bắt. Vẫn sót chim đứng yên hay bay chậm và gộp 2 con sát nhau: trên Roboflow vẽ thêm ô (công cụ Bounding Box, phím `B`), sửa hoặc xóa ô sai. Cách cũ (đốm từng frame, nhiễu hơn) còn ở `--draft blobs`. Có model đầu tiên rồi thì dùng chính model đó làm nhãn nháp cho phần ảnh còn lại.
- Côn trùng dưới đèn IR vẫn lọt vào nhãn nháp (đốm sáng 20–40 px, ngang cỡ chim): xóa ô khi gán nhãn, ảnh đó thành ảnh âm.

### 7.3. Gán nhãn

Nhãn nháp **không dùng trực tiếp để train**: nó khoanh cả lá cây, côn trùng, và gộp hai con chim sát nhau thành một ô.

Quy trình trên Roboflow (hoặc CVAT):

1. Tạo project loại Object Detection, một class `swiftlet`.
2. Tải lên ảnh **kèm** file `.txt` cùng tên (định dạng YOLO) để nhận sẵn nhãn nháp.
3. Sửa từng ảnh theo quy tắc dưới.
4. Export định dạng **YOLOv8** (nhãn dạng txt dùng chung cho YOLO26), **tắt** resize và augmentation của Roboflow (ultralytics tự làm khi train).

Quy tắc gán nhãn (cả nhóm thống nhất trước khi làm):

| Trường hợp | Cách xử lý |
|---|---|
| Chim rõ | Ô sát thân và cánh |
| Chim nhòe do chuyển động | Vẫn gán, ô bao cả vệt nhòe |
| Chim bị cắt ở mép ảnh | Gán nếu còn thấy trên một nửa |
| Hai chim chồng nhau | Hai ô riêng |
| Dơi, côn trùng, lá, bụi | **Không gán** (xóa ô nháp) — ảnh đó thành ảnh âm |
| Không chắc là chim | Không gán |

Mục tiêu số lượng:

- 1.500–3.000 ảnh có chim.
- Khoảng 10% ảnh âm (không có chim), ưu tiên ảnh có dơi/côn trùng.
- Mỗi người gán thử 50 ảnh rồi đối chiếu chéo trước khi gán hàng loạt.

### 7.4. Chia tập theo ngày — `tools/split_by_day.py`

Frame liên tiếp gần như giống hệt nhau. Chia ngẫu nhiên theo frame sẽ để ảnh "sinh đôi" lọt vào cả train lẫn test, cho kết quả đẹp giả. Phải chia theo **ngày quay**. Code: `ai-pipeline/tools/split_by_day.py`.

```powershell
# bản export YOLOv8 của Roboflow giải nén vào D:\SwiftletCare\dataset\roboflow
python tools/split_by_day.py D:\SwiftletCare\dataset\roboflow D:\SwiftletCare\dataset\final --val 20261024 --test 20261025
Compress-Archive D:\SwiftletCare\dataset\final\* D:\SwiftletCare\dataset\dataset.zip
```

- Ngày lấy từ 8 chữ số đầu tên file; Roboflow giữ tên gốc và thêm đuôi `_jpg.rf.<hash>` nên vẫn đọc được.
- Ảnh không có file nhãn được ghi nhãn rỗng (ảnh âm). Ghi `data.yaml` (`path: /content/dataset`, 1 class `swiftlet`).
- Một ngày không được vừa ở val vừa ở test; thiếu một trong ba tập thì công cụ báo lỗi.

Sau đó tải `dataset.zip` lên Google Drive (`MyDrive/swiftletcare/`).

### 7.5. Train trên Google Colab

Runtime → Change runtime type → **T4 GPU**. Mỗi khối dưới đây là một cell.

```python
# Cell 1 — môi trường
!pip install -q "ultralytics==8.4.170"    # ghim bản, xem mục 4
from google.colab import drive
drive.mount("/content/drive")
!rm -rf /content/dataset && unzip -q "/content/drive/MyDrive/swiftletcare/dataset.zip" -d /content/dataset
!cat /content/dataset/data.yaml
!ls /content/dataset/images/train | wc -l
```

Nếu file zip chứa thêm một cấp thư mục (`final/…`), sửa dòng `path:` trong `data.yaml` cho khớp.

```python
# Cell 2 — train
from ultralytics import YOLO

model = YOLO("yolo26n.pt")            # bản nano: nhanh nhất trên CPU (mục 6.1)
model.train(
    data="/content/dataset/data.yaml",
    imgsz=640,                        # bằng model.input_size; chim < 12 px sau khi resize → thu hẹp ROI trước, 960 làm chậm hơn 2,25 lần
    epochs=120,
    patience=25,                      # dừng sớm nếu val không cải thiện
    batch=16,
    project="/content/drive/MyDrive/swiftletcare/runs",
    name="swiftlet_v1",
    # augmentation phù hợp camera cố định:
    degrees=0.0,                      # camera không xoay
    flipud=0.0,                       # không lật dọc (đảo chiều ra/vào không có ý nghĩa với detect, nhưng nền bị lộn ngược)
    fliplr=0.5,
    scale=0.3,
    hsv_v=0.5,                        # ánh sáng thay đổi mạnh giữa sáng/chiều
    mosaic=1.0,
    close_mosaic=15,
)
```

```python
# Cell 3 — đánh giá trên tập TEST (ngày chưa từng thấy)
best = YOLO("/content/drive/MyDrive/swiftletcare/runs/swiftlet_v1/weights/best.pt")
metrics = best.val(data="/content/dataset/data.yaml", split="test", imgsz=640, conf=0.25,
                   nms=False)          # đo đúng đầu ra không NMS mà pipeline dùng
print("precision:", metrics.box.mp, "recall:", metrics.box.mr,
      "mAP50:", metrics.box.map50, "mAP50-95:", metrics.box.map)
```

```python
# Cell 4 — xem thử dự đoán bằng mắt
best.predict("/content/dataset/images/test", conf=0.25, save=True, max_det=100,
             project="/content/preview", name="test")
# mở /content/preview/test trong trình duyệt file của Colab
```

```python
# Cell 5 — export ONNX cho pipeline (imgsz phải bằng model.input_size trong config)
best.export(format="onnx", imgsz=640, nms=False, simplify=True)
!cp /content/drive/MyDrive/swiftletcare/runs/swiftlet_v1/weights/best.onnx \
    /content/drive/MyDrive/swiftletcare/swiftlet_v1.onnx
```

Tải `swiftlet_v1.onnx` về `ai-pipeline/models/`, rồi sửa `config.yaml`:

```yaml
model:
  path: "models/swiftlet_v1.onnx"
  version: "swiftlet_v1"
  classes:
    0: swiftlet
```

### 7.6. Đọc kết quả và cải thiện

Các file trong `runs/swiftlet_v1/`: `results.png` (đường loss và mAP), `PR_curve.png`, `confusion_matrix.png`, `val_batch*_pred.jpg`.

| Dấu hiệu | Nguyên nhân thường gặp | Cách xử lý |
|---|---|---|
| Recall thấp (sót chim) | Chim quá nhỏ, thiếu ảnh nhòe | Thu hẹp ROI, gán thêm ảnh nhòe; `imgsz=960` chỉ khi FPS còn dư (mục 18.4) |
| Precision thấp (bắt nhầm) | Thiếu ảnh âm | Thêm ảnh dơi/côn trùng/lá không gán nhãn |
| Val tốt nhưng test kém | Train và val cùng ngày, hoặc ít ngày | Thu thêm ngày, kiểm tra lại cách chia |
| Loss val tăng lại | Quá khớp | Giảm epoch, thêm dữ liệu |
| Tốt ban ngày, kém lúc chạng vạng | Thiếu ảnh tối/IR | Thu thêm đúng khung giờ đó |

Vòng lặp cải thiện (mỗi vòng 1–2 ngày):

1. Chạy model trên clip của một ngày mới.
2. Lấy những frame model sai (sót hoặc nhầm) — đây là dữ liệu giá trị nhất.
3. Gán nhãn thêm 200–300 frame đó, train lại thành `swiftlet_v2`.
4. So sánh v1 và v2 **trên cùng tập test**. Không đổi tập test giữa các phiên bản.

### 7.7. Chỉ số cuối cùng: độ chính xác đếm

mAP chỉ là chỉ số trung gian. Thứ cần báo cáo là sai số đếm.

1. Chọn ít nhất 6 clip × 5 phút từ **ngày test**: tối thiểu 3 clip **đủ sáng** và 3 clip **thiếu sáng** (đầu phiên sáng, cuối phiên chiều), có cả lúc đông và lúc thưa.
2. Hai người đếm tay độc lập số chim ra và vào, lấy trung bình.
3. Chạy pipeline trên từng clip, đọc dòng `KẾT QUẢ`:

```powershell
python src/stream.py --source D:/SwiftletCare/clips/20261025_morning_01.mp4 --session MORNING_EXIT --no-mqtt
```

4. Tính sai số = `|hệ thống − đếm tay| / đếm tay × 100%` cho từng chiều, và cho **số ròng** (ra trừ vào ở clip sáng, vào trừ ra ở clip chiều).
5. Báo cáo **riêng** nhóm đủ sáng và nhóm thiếu sáng (VISION-FR-016), kèm Precision/Recall của model trên tập test. So sai số của số thô với số ròng: cách nào sát đếm tay hơn thì dùng cho tỷ lệ chim về (mặc định trong backend là số ròng, mục 8.3).

**Xong khi:** đủ điều kiện Done của SRS cho VISION-FR-005 và VISION-FR-016 (có bảng sai số tách theo điều kiện sáng). Ngưỡng nội bộ đề xuất: sai số ≤ 10% trên các clip của ngày test. Phiếu đăng ký không cam kết con số; nếu không đạt 10% thì vẫn báo cáo số đo thật kèm điều kiện đo.

### 7.8. Nguồn dữ liệu có sẵn (bổ sung, không thay thế)

Kết quả tra cứu tháng 10/2026: **không tìm thấy bộ dữ liệu công khai nào quay chim yến bay qua lỗ ra vào để đếm**. Dữ liệu tự thu ở mục 7.1 vẫn là nguồn chính. Các nguồn dưới đây chỉ giúp model "biết trước" hình dạng chim nhỏ đang bay, để cần ít ảnh tự gán nhãn hơn.

| Nguồn | Nội dung | Quy mô | Mức phù hợp | Lưu ý |
|---|---|---|---|---|
| [FBD-SV-2024](https://github.com/Ziwei89/FBD-SV-2024) | Chim bay trong video camera giám sát cố định | 483 clip, 28.694 frame, 28.366 chim đã khoanh | **Cao nhất**: cùng kiểu camera cố định, chim nhỏ, nhòe | Nhãn dạng XML (kiểu VOC), có cả ID theo dõi. Tải từ Kaggle hoặc figshare (khoảng 1,7 GB). Trang dự án không ghi giấy phép rõ ràng, chỉ yêu cầu trích dẫn bài báo |
| [SOD4SB](https://github.com/IIM-TTIJ/MVA2023SmallObjectDetection4SpottingBirds) (MVA2023) | Chim rất nhỏ chụp từ drone | 39.070 ảnh, 137.121 chim | Trung bình: chim nhỏ nhưng góc nhìn từ trên cao | Chưa xác minh được giấy phép; đọc điều khoản trong repo trước khi dùng |
| Roboflow Universe: [ionest/swiftlet](https://universe.roboflow.com/ionest/swiftlet) | Bộ dữ liệu có tên chim yến, hai lớp `swiftlet`/`walet` | Nhỏ | **Chưa rõ** | Không mở được trang để kiểm tra. Phải tự xem ảnh: nếu là chim đậu trên tổ trong nhà thì không dùng được cho bài toán đếm chim bay |
| Roboflow Universe: [không gian `swiftlet`](https://universe.roboflow.com/swiftlet) | Một dự án object detection về chim yến | Khoảng 1.080 ảnh | **Chưa rõ** | Như trên: tự xem ảnh và giấy phép trước khi dùng |
| Roboflow Universe: [bird_flock](https://universe.roboflow.com/mai-ofuyr/bird_flock), [bird-flying](https://universe.roboflow.com/nycuproject/bird-flying-z8lwp) | Chim bay, đàn chim trên nền trời | Chưa kiểm tra | Thấp – trung bình | Ghi giấy phép CC BY 4.0. Chất lượng nhãn không đồng đều, phải xem mẫu trước |
| COCO (trọng số `yolo26n.pt`) | 80 lớp, có lớp `bird` | — | Đã dùng làm điểm xuất phát ở mục 7.5 | Chim trong COCO phần lớn to và rõ, khác chim yến đang bay |

Dữ liệu thiên địch (để dành cho THREAT-FR-001, ngoài phạm vi đợt này): Roboflow Universe có nhiều bộ ảnh cú, chuột, rắn. Đã có [một nghiên cứu](https://journal.ittelkom-sby.ac.id/jaiit/article/view/733) dùng ảnh cú từ Roboflow để train YOLOv8n phát hiện cú trong nhà yến.

**Quy tắc dùng dữ liệu ngoài:**

1. Dữ liệu ngoài **chỉ đưa vào tập train**. Tập val và test luôn chỉ gồm ảnh từ camera của mình, nếu không số liệu báo cáo sẽ không phản ánh đúng thực tế.
2. Xem bằng mắt ít nhất 50 ảnh của mỗi bộ trước khi dùng. Bỏ bộ nào có nhãn ẩu hoặc cảnh quá khác (chim đậu, chim to cận cảnh).
3. Ghi nguồn và giấy phép của từng bộ vào báo cáo.
4. Giữ hay bỏ dữ liệu ngoài được quyết định bằng số đo trên **tập test của mình**, không theo cảm tính.

**Cách dùng đề xuất: train hai bước** (học chim bay nói chung trước, rồi tinh chỉnh trên chim yến của mình).

Bước 1 — chuyển nhãn XML của FBD-SV-2024 sang YOLO, `tools/voc_to_yolo.py`:

```python
"""Chuyển nhãn VOC XML sang YOLO, gộp mọi lớp thành lớp 0.

Dùng: python tools/voc_to_yolo.py <thư mục chứa .xml> <thư mục ghi .txt>
"""
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

src, dst = Path(sys.argv[1]), Path(sys.argv[2])
dst.mkdir(parents=True, exist_ok=True)
n = 0
for xml in src.rglob("*.xml"):
    root = ET.parse(xml).getroot()
    w, h = float(root.findtext("size/width")), float(root.findtext("size/height"))
    lines = []
    for obj in root.iter("object"):
        b = obj.find("bndbox")
        x1, y1, x2, y2 = (float(b.findtext(k)) for k in ("xmin", "ymin", "xmax", "ymax"))
        if x2 <= x1 or y2 <= y1:
            continue                      # bỏ ô hỏng
        lines.append(f"0 {(x1 + x2) / 2 / w:.6f} {(y1 + y2) / 2 / h:.6f} {(x2 - x1) / w:.6f} {(y2 - y1) / h:.6f}")
    (dst / f"{xml.stem}.txt").write_text("\n".join(lines))
    n += 1
print(f"Đã chuyển {n} file")
```

Sắp ảnh và nhãn theo đúng cấu trúc `images/train`, `labels/train`, `images/val`, `labels/val` (dùng sẵn cách chia train/val của bộ dữ liệu), rồi viết `fbd.yaml` giống `data.yaml` ở mục 7.4 với một lớp `bird`. Cấu trúc thư mục gốc của bộ dữ liệu cần xem thực tế sau khi tải về.

Bước 2 — hai lượt train trên Colab:

```python
from ultralytics import YOLO

RUNS = "/content/drive/MyDrive/swiftletcare/runs"

# Lượt 1: học chim bay nói chung từ FBD-SV-2024
YOLO("yolo26n.pt").train(data="/content/fbd/fbd.yaml", imgsz=640, epochs=50, patience=15,
                         batch=16, project=RUNS, name="pretrain_fbd")

# Lượt 2: tinh chỉnh trên chim yến của mình, xuất phát từ kết quả lượt 1
YOLO(f"{RUNS}/pretrain_fbd/weights/best.pt").train(
    data="/content/dataset/data.yaml", imgsz=640, epochs=120, patience=25, batch=16,
    project=RUNS, name="swiftlet_v1_fbd",
    degrees=0.0, flipud=0.0, fliplr=0.5, scale=0.3, hsv_v=0.5, mosaic=1.0, close_mosaic=15,
)
```

Bước 3 — so sánh công bằng, cùng tập test, cùng ngưỡng:

```python
for name in ("swiftlet_v1", "swiftlet_v1_fbd"):          # v1: chỉ COCO → dữ liệu của mình (mục 7.5)
    m = YOLO(f"{RUNS}/{name}/weights/best.pt").val(data="/content/dataset/data.yaml", split="test", conf=0.25, nms=False)
    print(name, "precision", round(m.box.mp, 3), "recall", round(m.box.mr, 3), "mAP50", round(m.box.map50, 3))
```

Chọn bản có recall và mAP50 cao hơn trên tập test, rồi kiểm lại bằng sai số đếm (mục 7.7). Nếu hai bản ngang nhau, giữ bản không dùng dữ liệu ngoài vì đơn giản hơn và không vướng giấy phép. Bảng so sánh này đưa thẳng vào báo cáo được: nó cho thấy dữ liệu ngoài có giúp hay không.

Lợi ích của dữ liệu ngoài thường rõ nhất khi ảnh tự gán nhãn còn ít (vài trăm ảnh), và giảm dần khi đã có vài nghìn ảnh.


### 7.9. So sánh model: YOLOv8n, YOLO11n, YOLO26n

Chọn model theo **số đo trên dữ liệu chim yến của mình**, không theo bảng COCO ở mục 6.1. Trong lúc chưa so sánh xong, YOLO26n là mặc định (mục 6.1). Pipeline đọc được cả ba (mục 6.3), nên mỗi lần đổi model chỉ phải sửa `model.path` và `model.version` trong config.

| Ứng viên | Ra mắt | Mạnh | Yếu |
|---|---|---|---|
| YOLOv8n | 01/2023 | Ổn định nhất, nhiều tài liệu và ví dụ nhất, đúng tên trên phiếu đăng ký | Chậm nhất: 80,4 ms/khung trên CPU, gần như chắc chắn cần OpenVINO hoặc đầu vào nhỏ hơn mới đạt 25 fps |
| YOLO11n | 09/2024 | Đã dùng rộng rãi hơn 2 năm; 56,1 ms/khung | Vẫn chưa đủ 25 fps nếu không tăng tốc |
| YOLO26n | 01/2026 | Nhanh nhất (38,9 ms), mAP COCO cao nhất, có STAL cho vật thể nhỏ, không cần NMS | Mới nhất nên ít ví dụ trên mạng hơn |

Bản `s` (lớn hơn) không đưa vào: YOLO26s mất 87,2 ms/khung trên CPU, không đạt 25 fps nếu không có GPU.

**Giữ mọi thứ giống nhau** để so sánh công bằng: cùng tập dữ liệu và cách chia theo ngày (mục 7.4), cùng `ultralytics==8.4.170`, cùng `imgsz`, epoch, augmentation và `seed`. Đo đếm trên cùng các clip test (mục 7.7). Đo FPS trên cùng máy sẽ chạy thật, cùng `providers`.

Bước 1 — train cả ba trên Colab. Mỗi model chạy khoảng 2 giờ trên T4. Nếu Colab ngắt phiên giữa chừng thì chạy lại vòng lặp; nên sửa `CANDIDATES` để bỏ model đã xong, vì kết quả đã lưu trên Drive.

```python
!pip install -q "ultralytics==8.4.170"
from ultralytics import YOLO

RUNS = "/content/drive/MyDrive/swiftletcare/runs"
DATA = "/content/dataset/data.yaml"
AUG = dict(degrees=0.0, flipud=0.0, fliplr=0.5, scale=0.3, hsv_v=0.5, mosaic=1.0, close_mosaic=15)
CANDIDATES = {"yolov8n": {}, "yolo11n": {}, "yolo26n": {"nms": False}}   # YOLO26: đo và export đúng đầu ra không NMS

for name, head in CANDIDATES.items():
    YOLO(f"{name}.pt").train(data=DATA, imgsz=640, epochs=120, patience=25, batch=16,
                             seed=0, deterministic=True, project=RUNS, name=f"cmp_{name}", **AUG)
    best = YOLO(f"{RUNS}/cmp_{name}/weights/best.pt")
    m = best.val(data=DATA, split="test", imgsz=640, conf=0.25, **head)
    print(name, "precision", round(m.box.mp, 3), "recall", round(m.box.mr, 3),
          "mAP50", round(m.box.map50, 3), "mAP50-95", round(m.box.map, 3))
    best.export(format="onnx", imgsz=640, simplify=True, **head)   # → cmp_<name>/weights/best.onnx
```

Bước 2 — trên máy chạy thật, lần lượt với từng file `.onnx`: sửa `model.path`/`model.version`, chạy đủ các clip test của mục 7.7 với `--no-mqtt`. Ghi lại dòng `KẾT QUẢ` và FPS trong log. Chạy trên file thì pipeline xử lý nhanh hết mức, nên FPS đo được là tốc độ tối đa của máy.

Bước 3 — điền bảng (đưa thẳng vào báo cáo VISION-FR-016):

| Model | Precision | Recall | mAP50 | Sai số ròng đủ sáng | Sai số ròng thiếu sáng | FPS trên máy thật | Đạt 25 fps? |
|---|---|---|---|---|---|---|---|
| YOLOv8n | | | | | | | |
| YOLO11n | | | | | | | |
| YOLO26n | | | | | | | |

**Cách chọn**, áp dụng theo thứ tự:

1. Loại model không đạt **≥ 25 fps** trên máy thật. Mọi model được dùng cùng cách tăng tốc ở bước 2 của mục 18.4 (OpenVINO nếu là CPU Intel).
2. Loại model có sai số đếm **> 10%**, theo ngưỡng nội bộ ở mục 7.7.
3. Trong các model còn lại, chọn model có **sai số ròng thấp nhất**, xét cả hai nhóm đủ sáng và thiếu sáng.
4. Nếu sai số chênh nhau không đáng kể (ngưỡng nhóm tự chọn: ≤ 1 điểm %), chọn **bản ổn định hơn**, theo thứ tự YOLOv8n → YOLO11n → YOLO26n.
5. Nếu cả ba đều trượt bước 1, áp dụng tiếp các bước 3–5 của mục 18.4 cho model có sai số thấp nhất, rồi đo lại.

Chỉ model được chọn mới đi tiếp vào GĐ5 (chạy 24 giờ, mục 10). Ghi tên model và phiên bản (`model.version`, ví dụ `swiftlet_v1_yolo26n`) vào config và báo cáo.

---

## 8. GĐ3 — Backend

Thời gian: 2 ngày. Tuân theo quy tắc Route → Controller → Service → Model của module `backend/`.

> **Trạng thái (SRS v2.1.6):** §8.1–8.5 và §8.7 **đã làm** (`backend/src/services/birdCount.service.ts`, `jobs/returnRate.job.ts`, `tests/integration/birdCount.test.ts`); **§8.6 đã làm ở SRS v2.1.7** (`stream.service.ts`, `routes/internal.route.ts`, `tests/integration/streamAuth.test.ts`, MediaMTX 1.21.1 trong `docker-compose.yml` + `deploy/mediamtx.yml`), khác code mẫu ở chỗ: token người xem nhận qua header Bearer (trường `token`), `?token=` hoặc ô mật khẩu, không chỉ `query`; pipeline đọc hình gốc bằng mật khẩu dịch vụ (§18.3) nhưng token người xem không đọc được đường `-raw`; `device_id` kết thúc bằng `-raw` không được cấp token. Chỗ code thật khác code mẫu của §8.1–8.5:
> - **[SRS v2.1.8] Camera và số đếm theo nhà yến (House), không theo Zone hay camera.** Camera ở cửa ra vào của cả nhà (1–2 cửa) nên `camera_nodes`, `bird_count_records`, `bird_count_buckets` mang `house_id`; nút AI publish `swiftletcare/{farm}/{house}/heartbeat|vision/bird-count|vision/alert` (không có đoạn zone). `houseDailyCounts()` cộng số thô mọi camera của nhà theo `session_date` rồi mới lấy số ròng và tỷ lệ (chim có thể ra cửa này về cửa kia); không lưu `return_rate` trên bản ghi. Mọi chỗ đọc dùng hàm này: `GET /analytics/bird-count/current` (mới), `/daily`, `/trends`, `/buckets` (`houseId`; `zoneId` cũ được quy ra nhà chứa Zone), `/correlation`, socket `BIRD_COUNT_UPDATE` (room `house:<id>` qua `JOIN_HOUSE`), job `LOW_RETURN_RATE` (1 cảnh báo cho cả nhà, mức giảm `houses.bird_count_tuning`), báo cáo sức khỏe Zone, ảnh chụp đàn khi thu hoạch. Code mẫu bên dưới là bản theo Zone/camera, đã thay.
> - `checkReturnRateDrops` còn **đóng** `LOW_RETURN_RATE` đang mở khi tỷ lệ đã hồi lại; không có bước này thì dedup nuốt mọi lần giảm của những ngày sau. `LOW_RETURN_RATE` thành loại chỉ backend được tạo (thiết bị gửi lên bị từ chối).
> - `/daily` và `/correlation` gom theo `session_date` (ngày giờ VN), không gom theo ngày UTC của `timestamp`: phiên sáng 05:30 VN là 22:30 UTC hôm trước.
> - Nút AI mất heartbeat quá 90 giây sinh `EDGE_AI_DEGRADED` (THREAT-FR-010), không phải `NODE_OFFLINE`; `vision/alert` của camera chỉ nhận `EDGE_AI_DEGRADED`.
> - Mức giảm lấy qua `resolveDetectionTuning(zone.detection_tuning)`, không viết `?? 20`.
> - Job dùng `{ timezone: 'Asia/Ho_Chi_Minh' }` của node-cron, không phụ thuộc giờ máy chủ.

### 8.1. Model `birdCountRecord.model.ts`

Thêm `session_date` và unique index để upsert:

```ts
session_date: { type: String, required: true },   // 'YYYY-MM-DD' theo giờ Việt Nam
...
birdCountSchema.index({ camera_node_id: 1, session_type: 1, session_date: 1 }, { unique: true })
```

Collection đang rỗng nên không cần migration.

Model mới `birdCountBucket.model.ts` (VISION-FR-017) — số chim qua vạch theo khoảng 5 phút, cả ngoài phiên:

```ts
camera_node_id: { type: Schema.Types.ObjectId, ref: 'CameraNode', required: true },
zone_id:        { type: Schema.Types.ObjectId, ref: 'Zone', required: true },
bucket_start:   { type: Date, required: true },          // đầu khoảng, đã làm tròn xuống theo bucket_minutes
entry_count:    { type: Number, required: true, min: 0 },
exit_count:     { type: Number, required: true, min: 0 },
...
birdCountBucketSchema.index({ camera_node_id: 1, bucket_start: 1 }, { unique: true })
birdCountBucketSchema.index({ zone_id: 1, bucket_start: -1 })
birdCountBucketSchema.index({ bucket_start: 1 }, { expireAfterSeconds: 90 * 24 * 3600 })   // giữ 90 ngày như telemetry
```

### 8.2. Type `BirdCountPayload` (`types/domain.types.ts`)

Thêm `final?: boolean`, `kind?: 'BUCKET'`, `bucket_start?: number` (epoch ms), `bucket_minutes?: number`. `return_rate` chuyển thành tùy chọn vì backend tự tính; `session_type` chỉ bắt buộc với tin của phiên (không có `kind`).

### 8.3. `services/birdCount.service.ts` (mới)

```ts
import { CameraNode, IN_SERVICE } from '@/models/device.model'
import { Zone } from '@/models/houseZone.model'
import { BirdCountRecord } from '@/models/birdCountRecord.model'
import { BirdCountBucket } from '@/models/birdCountBucket.model'
import { emitBirdCountUpdate } from '@/socket'
import { createAlert } from '@/services/alert.service'
import { BadRequestError, NotFoundError } from '@/utils/appError.util'
import type { BirdCountPayload, SessionType } from '@/types'

const SESSION_TYPES: SessionType[] = ['MORNING_EXIT', 'EVENING_ENTRY']
const VN_OFFSET_MS = 7 * 3600_000
const isCount = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0
const vnDate = (d: Date) => new Date(d.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10)
/** Số ròng: chim lượn qua lại vạch đếm làm cả hai chiều phồng lên, phép trừ triệt tiêu phần đó */
const net = (main: number, opposite: number) => Math.max(main - opposite, 0)

/** VISION-FR-006/008/009/017 — gọi từ mqtt/handlers/birdCount.handler.ts */
export async function ingestBirdCount(payload: BirdCountPayload): Promise<void> {
  const { deviceId, entry_count, exit_count } = payload
  if (!deviceId || !isCount(entry_count) || !isCount(exit_count)) {
    throw BadRequestError('Payload bird-count không hợp lệ')
  }

  const node = await CameraNode.findOne({ device_id: deviceId, ...IN_SERVICE })
  if (!node) throw NotFoundError(`Không tìm thấy CameraNode với device_id="${deviceId}"`)

  // VISION-FR-017: số đếm theo khoảng 5 phút, có cả ngoài phiên
  if (payload.kind === 'BUCKET') {
    if (!Number.isFinite(payload.bucket_start)) throw BadRequestError('Thiếu bucket_start')
    await BirdCountBucket.updateOne(
      { camera_node_id: node._id, bucket_start: new Date(payload.bucket_start as number) },
      { $set: { zone_id: node.zone_id, entry_count, exit_count } },
      { upsert: true },
    )
    return
  }

  const { session_type } = payload
  if (!SESSION_TYPES.includes(session_type)) throw BadRequestError('session_type không hợp lệ')

  const timestamp = new Date(payload.timestamp || Date.now())
  const session_date = vnDate(timestamp)

  // VISION-FR-009: tỷ lệ chim về = số ròng về buổi chiều / số ròng ra buổi sáng cùng ngày
  let return_rate: number | undefined
  if (session_type === 'EVENING_ENTRY') {
    const morning = await BirdCountRecord.findOne({
      camera_node_id: node._id, session_type: 'MORNING_EXIT', session_date,
    }).select('entry_count exit_count').lean()
    const left = morning ? net(morning.exit_count, morning.entry_count) : 0
    if (left > 0) return_rate = +((net(entry_count, exit_count) / left) * 100).toFixed(2)
  }

  await BirdCountRecord.updateOne(
    { camera_node_id: node._id, session_type, session_date },
    {
      $set: {
        zone_id: node.zone_id, timestamp, entry_count, exit_count,   // số thô của cả hai chiều vẫn được lưu
        confidence_avg: payload.confidence_avg,
        ...(return_rate !== undefined && { return_rate }),
      },
    },
    { upsert: true },
  )

  emitBirdCountUpdate(String(node.zone_id), {
    zoneId: String(node.zone_id), entryCount: entry_count, exitCount: exit_count,
    returnRate: return_rate ?? 0, sessionType: session_type, timestamp: timestamp.toISOString(),
  })
}

/**
 * VISION-FR-011 — tỷ lệ chim về giảm quá ngưỡng so với trung bình 7 ngày trước.
 * Gọi từ jobs/returnRate.job.ts sau khi phiên chiều kết thúc, không dựa vào tin `final` của
 * pipeline (pipeline khởi động lại đúng lúc đổi phiên thì tin đó không bao giờ tới).
 * Chạy lại nhiều lần vẫn an toàn: `createAlert` gộp cảnh báo còn mở của cùng sự cố.
 */
export async function checkReturnRateDrops(sessionDate = vnDate(new Date())): Promise<void> {
  const today = await BirdCountRecord.find({
    session_type: 'EVENING_ENTRY', session_date: sessionDate, return_rate: { $exists: true },
  }).select('camera_node_id zone_id return_rate').lean()

  for (const rec of today) {
    const previous = await BirdCountRecord.find({
      camera_node_id: rec.camera_node_id, session_type: 'EVENING_ENTRY',
      session_date: { $lt: sessionDate }, return_rate: { $exists: true },
    }).sort({ session_date: -1 }).limit(7).select('return_rate').lean()
    if (previous.length < 3) continue                // chưa đủ dữ liệu nền để so sánh

    const avg = previous.reduce((sum, r) => sum + r.return_rate, 0) / previous.length
    const dropPct = avg > 0 ? ((avg - rec.return_rate) / avg) * 100 : 0

    const zone = await Zone.findById(rec.zone_id).select('farm_id name detection_tuning').lean()
    if (!zone) continue
    const limit = zone.detection_tuning?.return_rate_drop_pct ?? 20   // EXPERT-FR-008: chuyên gia chỉnh theo Zone
    if (dropPct <= limit) continue

    await createAlert({
      farmId: String(zone.farm_id), zoneId: String(rec.zone_id), nodeId: String(rec.camera_node_id),
      type: 'LOW_RETURN_RATE',
      title: `Tỉ lệ chim về giảm tại ${zone.name}`,
      message: `Tỉ lệ chim về ${rec.return_rate.toFixed(1)}%, giảm ${dropPct.toFixed(1)}% so với trung bình ${previous.length} ngày trước (${avg.toFixed(1)}%)`,
      metadata: { returnRate: rec.return_rate, avg, dropPct, limit },
    })
  }
}
```

- `jobs/returnRate.job.ts` (mới): `node-cron` chạy `checkReturnRateDrops()` lúc 19:15 giờ Việt Nam mỗi ngày (sau khi phiên chiều kết thúc; đổi giờ nếu đổi khung giờ phiên ở mục 6.2).
- `GET /analytics/bird-count/buckets?zoneId=&from=&to=` (mới): trả các bản ghi 5 phút của Zone trong khoảng thời gian, dùng cho biểu đồ theo giờ và cho màn kiểm chứng cảnh báo của Domain Expert (số chim ra/vào ±30 phút quanh một cảnh báo — EXPERT-FR-003).
- Tỷ lệ chim về có thể vượt 100% (chim về nhiều hơn số đã đếm ra): không kẹp lại, để nguyên cho người xem thấy.
- Tên import (`Zone`, `IN_SERVICE`, đường dẫn `@/socket`) và trường `zones.detection_tuning` (SRS EXPERT-FR-008, chưa có trong code) cần đối chiếu lại với code thật khi viết.

### 8.4. `mqtt/handlers/birdCount.handler.ts`

```ts
import type { BirdCountPayload } from '@/types'
import { ingestBirdCount } from '@/services/birdCount.service'
import logger from '@/utils/logger.util'

export async function handleBirdCount(_topicParts: string[], message: Record<string, unknown>): Promise<void> {
  try {
    await ingestBirdCount(message as unknown as BirdCountPayload)
  } catch (err) {
    logger.error('birdCountHandler error', { err })
  }
}
```

### 8.5. Trạng thái ONLINE/OFFLINE của camera

- `device.service#recordHeartbeat`: khi không tìm thấy `SensorNode`, thử `CameraNode` — đặt `status: 'ONLINE'`, `last_heartbeat`, `model_version` (lấy từ `firmwareVersion`), rồi phát `DEVICE_STATUS_CHANGE` nếu trước đó chưa ONLINE. Bỏ qua phần đẩy config (chỉ dành cho ESP32).
- `jobs/deviceOffline.job.ts`: quét thêm `CameraNode` với ngưỡng 90 giây (pipeline gửi heartbeat mỗi 30 giây).

### 8.6. Kiểm quyền xem stream (MediaMTX hỏi backend)

Video không đi qua backend. MediaMTX nhận video từ pipeline và phát cho trình duyệt; mỗi lần có ai đẩy hoặc xem, nó gọi backend để hỏi quyền.

Quy ước: đường dẫn stream của một camera là `cam-<device_id>` (nên `device_id` chỉ gồm chữ, số, dấu gạch).

Hai endpoint mới:

| Endpoint | Ai gọi | Việc làm |
|---|---|---|
| `GET /devices/camera-nodes/:id/stream-token` | Frontend (đã đăng nhập) | Kiểm quyền theo farm của Zone, trả `{ path, token }` — token sống 60 giây, chỉ dùng cho đúng camera đó |
| `POST /internal/stream-auth?key=…` | MediaMTX (mạng nội bộ Docker) | Trả 200 nếu được phép, 401 nếu không |

`services/stream.service.ts` (mới):

```ts
import jwt from 'jsonwebtoken'
import { CameraNode, IN_SERVICE } from '@/models/device.model'
import { assertZoneAccess } from '@/utils/farmAccess.util'
import { NotFoundError, UnauthorizedError } from '@/utils/appError.util'
import type { CurrentUser } from '@/types'

// Khóa riêng, KHÔNG dùng JWT_ACCESS_SECRET: token stream không được phép dùng làm access token
const tokenSecret = () => process.env.STREAM_TOKEN_SECRET as string

/** VISION-FR-013 — cấp token xem stream của một camera */
export async function issueStreamToken(cameraNodeId: string, user: CurrentUser) {
  const node = await CameraNode.findOne({ _id: cameraNodeId, ...IN_SERVICE }).select('device_id zone_id').lean()
  if (!node) throw NotFoundError('Không tìm thấy camera')
  await assertZoneAccess(String(node.zone_id), user)
  const path = `cam-${node.device_id}`
  return { path, token: jwt.sign({ path }, tokenSecret(), { expiresIn: '60s' }) }
}

interface MediaMtxAuthRequest { action?: string; path?: string; password?: string; query?: string }

/** MediaMTX gọi mỗi khi có kết nối đẩy (publish) hoặc xem (read) */
export function authorizeStream(key: unknown, body: MediaMtxAuthRequest): void {
  if (!process.env.STREAM_AUTH_KEY || key !== process.env.STREAM_AUTH_KEY) throw UnauthorizedError('Sai khóa')

  if (body.action === 'publish') {
    const ok = !!process.env.STREAM_PUBLISH_SECRET && body.password === process.env.STREAM_PUBLISH_SECRET
    if (!ok || !body.path?.startsWith('cam-')) throw UnauthorizedError('Không được phép đẩy stream')
    return
  }
  if (body.action === 'read') {
    const token = new URLSearchParams(body.query ?? '').get('token') ?? ''
    try {
      const payload = jwt.verify(token, tokenSecret()) as { path?: string }
      if (payload.path === body.path) return
    } catch { /* hết hạn hoặc sai chữ ký → rơi xuống dưới */ }
  }
  throw UnauthorizedError('Không được phép xem stream')
}
```

- **Ai được xem:** Farm Owner và Domain Expert của farm chứa camera (SRS v2.1, VISION-FR-013). Code mẫu gọi `assertZoneAccess` vì đó là hàm hiện có; khi backend đổi role theo SRS mục 0.5 (bỏ phạm vi Zone, `FARM_OPERATOR` thành `DOMAIN_EXPERT`) thì route này mở cho cả hai role và hàm kiểm quyền chỉ còn xét thành viên farm.
- Controller chỉ gọi service rồi trả `res.json({ success: true })`; `errorHandler` tự trả 401.
- Route `/internal` không gắn `authenticate` (MediaMTX không có JWT người dùng). Nó được bảo vệ bằng `STREAM_AUTH_KEY` và bị Caddy chặn từ bên ngoài (mục 15.4).
- Tên trường trong body (`action`, `path`, `password`, `query`) lấy theo tài liệu HTTP authentication của MediaMTX; cần đối chiếu với đúng phiên bản đang dùng.
- Biến môi trường mới: `STREAM_TOKEN_SECRET`, `STREAM_AUTH_KEY`, `STREAM_PUBLISH_SECRET` — thêm vào `backend/.env.example`.

### 8.7. Việc kèm theo

- `listCameraNodes`: loại `rtsp_url` khỏi response (chứa mật khẩu camera).
- `docs/api/api-spec.yaml`: thêm endpoint `stream-token`, `GET /analytics/bird-count/buckets`, field `session_date`.
- Test đơn vị cho `authorizeStream`: sai khóa, sai mật khẩu publish, token hết hạn, token của camera khác → đều bị từ chối.
- Test tích hợp `tests/integration/birdCount.test.ts`:
  - payload hợp lệ → có 1 bản ghi; gửi lần 2 cùng phiên → vẫn 1 bản ghi, số được cập nhật;
  - sáng `exit_count = 110`, `entry_count = 10`; chiều `entry_count = 95`, `exit_count = 10` → số ròng 85/100, `return_rate = 85`;
  - tin `kind: "BUCKET"` → có 1 bản ghi trong `BirdCountBucket`; gửi lại cùng `bucket_start` → vẫn 1 bản ghi; không tạo `BirdCountRecord`;
  - `checkReturnRateDrops`: 3 ngày trước 90%, hôm nay 60% → có cảnh báo `LOW_RETURN_RATE`; chạy lại lần 2 → không thêm cảnh báo mới;
  - `deviceId` không tồn tại, số âm, `session_type` lạ → bị từ chối, không ghi DB.

Kiểm tra tay:

```powershell
mosquitto_pub -h localhost -p 1883 -t "swiftletcare/F/H/Z/vision/bird-count" -m '{\"deviceId\":\"cam-zone1-01\",\"session_type\":\"MORNING_EXIT\",\"entry_count\":3,\"exit_count\":120,\"confidence_avg\":0.8,\"timestamp\":1760000000000}'
```

**Xong khi:** test qua, `npm run lint` và `npm run build:check` sạch, gửi payload thì thấy bản ghi trong Mongo và sự kiện `BIRD_COUNT_UPDATE` ở client.

---

## 9. GĐ4 — Frontend

Thời gian: 1,5 ngày. Tuân theo `frontend/FE_Design_Claude.md` và quy tắc thư mục theo vai trò.

| Việc | File |
|---|---|
| Thêm `onBirdCountUpdate` theo đúng mẫu các subscriber `on*Update` sẵn có | `src/lib/socket.ts` |
| API lấy danh sách camera của zone và stream token | `src/apis/farm-owner/` (kiểm tra xem đã có API camera chưa) |
| Hook `useBirdCountLive(zoneId)`: giữ số vào/ra mới nhất từ socket | `src/hooks/farm-owner/` |
| Hook `useWhepStream(videoRef, cameraNodeId)`: xin token, mở kết nối WebRTC, gắn vào thẻ `<video>` | `src/hooks/farm-owner/` |
| Thay mock bằng stream thật | `components/features/farm-owner/vision/LiveCameraCard.tsx` |
| Nối số live | `components/features/farm-owner/vision/BirdStatsCards.tsx` |
| Dùng lại `LiveCameraCard`, hoặc bỏ trang và trỏ menu về trang Vision | `pages/farm-owner/FarmOwnerLiveStreamPage.tsx` |
| Biểu đồ số chim ra/vào theo khoảng 5 phút (`GET /analytics/bird-count/buckets`); dùng lại trong màn kiểm chứng cảnh báo của Domain Expert | `src/apis/` + `src/hooks/` (đặt ở `shared/` vì cả Farm Owner và Domain Expert dùng) |

Thay đổi chính trong `LiveCameraCard`:

```tsx
// thay khối nút Play + 2 <DetectionBox> giả bằng:
{cameraNodeId
  ? <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-contain" />
  : <EmptyState title="Chưa có camera" description="Zone này chưa có Camera Node đang hoạt động." />}
```

Hook WebRTC (giao thức WHEP, không cần thêm thư viện):

```ts
// hooks/farm-owner/useWhepStream.ts
import { useEffect, type RefObject } from 'react'
import { getStreamToken } from '@/apis/farm-owner/camera.api'   // GET /devices/camera-nodes/:id/stream-token

const STREAM_URL = import.meta.env.VITE_STREAM_URL   // https://stream.<tên miền>

export function useWhepStream(videoRef: RefObject<HTMLVideoElement>, cameraNodeId?: string) {
  useEffect(() => {
    if (!cameraNodeId || !STREAM_URL) return
    const pc = new RTCPeerConnection()
    let cancelled = false

    void (async () => {
      const { path, token } = await getStreamToken(cameraNodeId)
      pc.addTransceiver('video', { direction: 'recvonly' })
      pc.ontrack = e => { if (videoRef.current) videoRef.current.srcObject = e.streams[0] }
      await pc.setLocalDescription(await pc.createOffer())
      // chờ gom xong ICE candidate (tối đa 2 giây) rồi mới gửi offer
      await new Promise<void>(resolve => {
        if (pc.iceGatheringState === 'complete') return resolve()
        pc.addEventListener('icegatheringstatechange', () => pc.iceGatheringState === 'complete' && resolve())
        setTimeout(resolve, 2000)
      })
      const res = await fetch(`${STREAM_URL}/${path}/whep?token=${token}`, {
        method: 'POST', headers: { 'Content-Type': 'application/sdp' }, body: pc.localDescription?.sdp,
      })
      if (!res.ok || cancelled) return
      await pc.setRemoteDescription({ type: 'answer', sdp: await res.text() })
    })().catch(() => { /* hiện trạng thái "camera ngoại tuyến" qua state của component */ })

    return () => { cancelled = true; pc.close() }
  }, [cameraNodeId, videoRef])
}
```

- Xóa component `DetectionBox` và dòng chú thích "Dữ liệu minh hoạ".
- Xóa nhãn giả "1080p @ 60fps · Độ trễ ~120ms · RTSP".
- **Bỏ nút "Hiện khung nhận diện"**: ô xanh đã nằm sẵn trong video. Muốn giữ nút này phải đẩy thêm một luồng không có khung, tốn gấp đôi băng thông upload — chỉ làm khi thật sự cần.
- Thêm trạng thái "Camera ngoại tuyến" khi kết nối thất bại hoặc `connectionState` chuyển sang `failed`/`disconnected`, kèm nút thử lại.
- Thêm `VITE_STREAM_URL` vào file env của frontend.

Mobile (`mobile/app/livestream/[zoneId].tsx`): **thuộc cam kết của phiếu đăng ký** (ứng dụng mobile xem được live stream có khung), không phải phần tùy chọn. Cách làm chưa được khảo sát, cần thử theo thứ tự: (1) `react-native-webview` mở một trang xem tối giản của web (kèm token) — kiểm tra WebRTC chạy được trong WebView trên Android và iOS; (2) nếu không được thì dùng `react-native-webrtc` với cùng giao thức WHEP. Dành nửa ngày để thử cách 1 ngay khi web xem được.

**Xong khi:** mở trang Vision **bằng 4G, ngoài mạng nhà yến**, thấy hình có ô xanh và số vào/ra nhảy theo thời gian thực; `npm run lint` và `npm run build` sạch.

---

## 10. GĐ5 — Chạy thật và ổn định

Thời gian: 2 ngày.

1. Đổi `model.path` sang model đã train, chạy `python src/stream.py` với camera thật.
2. Tự chạy lại khi lỗi. Với kiến trúc đã chốt, pipeline là container `vision` trên VPS và `restart: unless-stopped` đã lo việc này (mục 18.3). Lệnh Task Scheduler dưới đây chỉ dùng cho **phương án lùi** (PC Windows tại nhà yến):

```powershell
$action = New-ScheduledTaskAction -Execute "C:\path\ai-pipeline\.venv\Scripts\python.exe" -Argument "src\stream.py" -WorkingDirectory "C:\path\ai-pipeline"
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -RestartCount 99 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName "SwiftletCare-Vision" -Action $action -Trigger $trigger -Settings $settings
```

3. (Phương án lùi) Tắt chế độ ngủ của máy.
4. Thử các tình huống lỗi:

| Tình huống | Kết quả mong đợi |
|---|---|
| Rút cáp camera 30 giây | Log báo mất luồng, tự nối lại, đếm tiếp |
| Tắt EMQX 1 phút | Pipeline vẫn chạy, tin QoS 1 được gửi bù khi broker lên |
| Rút cáp Internet của nhà yến 2 phút | Kiến trúc đã chốt: VPS mất hình, **số đếm của 2 phút đó bị thiếu**; có mạng lại thì MediaMTX tự kéo lại và đếm tiếp, số đã đếm không mất. Ghi nhận là hạn chế. (Phương án lùi: pipeline tại chỗ vẫn đếm đủ) |
| Tắt pipeline giữa phiên rồi bật lại | Số đếm tiếp tục từ `state.json`, không về 0 |
| Chạy qua ranh giới 07:00 | Gửi tin `final: true`, số đếm về 0 cho giai đoạn ngoài phiên |
| Tắt pipeline 2 phút | Camera chuyển OFFLINE trên dashboard |

5. Chạy trọn một phiên sáng và một phiên chiều, đối chiếu `return_rate` trên trang Analytics.

**Xong khi:** chạy liên tục 24 giờ không cần can thiệp, đủ 6 tình huống trên đạt.

---

## 11. GĐ6 — Đánh giá và tài liệu

Thời gian: 1,5 ngày.

Báo cáo `docs/test-reports/vision-counting.md`:

| Clip | Phiên | Điều kiện sáng | Đếm tay (ra / vào) | Hệ thống (ra / vào) | Sai số ra | Sai số vào | Sai số ròng | FPS |
|---|---|---|---|---|---|---|---|---|
| 20261011_morning_01 | Sáng | Thiếu sáng | | | | | | |
| … | | | | | | | | |
| **Trung bình — đủ sáng** | | | | | | | | |
| **Trung bình — thiếu sáng** | | | | | | | | |

Kèm theo: cấu hình máy, phiên bản model, mAP50/precision/recall trên tập test, số ảnh train/val/test, ảnh chụp màn hình stream có ô xanh.

Tài liệu cần sửa:

- `SwiftletCare_SRS.md`: phần mô tả đã được cập nhật ở v2.1 (nút AI là PC hoặc máy chủ, 1 class, stream có khung là bắt buộc, VISION-FR-016/017). Còn lại: cập nhật cột trạng thái VISION-FR-001…017 khi từng phần chạy được.
- Ghi rõ các giới hạn bảo mật còn lại của bản demo (mục 15.7) vào phần hạn chế của báo cáo.
- `CLAUDE.md`: mục AI pipeline và mục trạng thái module.
- `ai-pipeline/README.md`: cách cài, cấu hình ROI và vạch đếm, cách train lại.
- `docs/hardware/BOM.md`: thêm camera và máy xử lý.

---

## 12. Phần tùy chọn

Chỉ làm khi thật sự cần.

| Hạng mục | Khi nào cần | Cách làm |
|---|---|---|
| Luồng video không có khung (cho nút bật/tắt khung) | Người dùng thật sự cần xem hình gốc | Đẩy thêm một đường `cam-<id>-raw`; tốn gấp đôi băng thông upload |
| Tăng tốc suy luận | FPS dưới mục tiêu | Theo thứ tự ở mục 18.4: `onnxruntime-openvino` (CPU Intel) → đầu vào 480/416 trên ROI hẹp → hạ camera 20 fps |
| Phát hiện thiên địch (THREAT-FR-001) | Có dữ liệu chuột/rắn/cú và camera nhìn vào trong nhà | Thêm class, sửa `alert_publisher.py` (thêm `deviceId`), cho `ingestDeviceAlert` tra cả `CameraNode` |
| Ghi hình sự kiện (VISION-FR-015) | Sau khi phần đếm ổn định, và khi VPS có chỗ: luồng 2 Mbps ghi cả ngày tốn khoảng 150 GB mỗi 7 ngày; thẻ nhớ camera đã ghi liên tục (19.3) | Tính năng có sẵn của MediaMTX: `record: yes` chỉ trong giờ phiên, `recordDeleteAfter: 7d`, `playback: yes` cho đường `cam-<id>` (đã vẽ khung); backend cấp token xem lại giống `stream-token` (SRS 0.5) |
| Vẽ vòng đếm trên giao diện (VISION-FR-018) | Khi phải chỉnh vòng mà không muốn sửa `config.yaml` tay (mục 19.8) | **Đã có backend + pipeline (SRS v2.1.10):** `PUT /devices/camera-nodes/:id/counting-ring` lưu theo camera, gửi qua `swiftletcare/{farmId}/{houseId}/config/update` kèm `deviceId`; `src/remote_config.py` lưu `state/counting_ring.json` (thắng `tracking.ring`), áp ngay (từ 22/10 vùng theo dõi là cả khung nên không còn tính lại ROI theo vòng, mục 19.8). Còn màn vẽ ở web |

---

## 13. Rủi ro

| Rủi ro | Dấu hiệu | Cách xử lý |
|---|---|---|
| Chim nhỏ, bay nhanh: hai box liên tiếp không chồng nhau, ByteTrack mất dấu | `#id` đổi liên tục, số đếm thấp hơn thực tế | Tăng `box_pad`; tăng FPS; nếu vẫn hỏng thì đổi sang tracker theo khoảng cách tâm (`norfair`). **Kiểm tra ngay ở GĐ1.** |
| Nhòe chuyển động, thiếu sáng lúc chạng vạng | Sót nhiều ở cuối phiên chiều | Chỉnh phơi sáng, bật IR, thêm ảnh nhòe/tối vào tập train |
| Chim bay thành đàn dày, che nhau | Đếm thiếu ở giờ cao điểm | Thu hẹp khung vào lỗ, đặt vạch ở chỗ chim tách hàng |
| Dơi, côn trùng bị đếm nhầm | Đếm thừa lúc chạng vạng | Ảnh âm trong tập train, tăng ngưỡng confidence |
| Không kịp gán nhãn | Hết thời gian GĐ2 | Đếm bằng background subtraction (vẫn có ô xanh, không cần train) — không phân biệt được chim với vật khác |
| CPU không đủ FPS | FPS trong log thấp hơn tốc độ khung hình của camera | Xem mục 18.4 và dòng "Tăng tốc suy luận" ở mục 12 |
| Đèn hồng ngoại 850 nm của camera làm chim khó chịu | Chim né cửa, số chim về giảm sau khi lắp camera | Cổng kiểm tra 6 (mục 19.5); hỏi người nuôi yến; tắt IR hoặc đổi camera IR 940 nm |
| Cổng camera mở ra Internet mà modem không lọc được IP nguồn | Người lạ xem được hình, dò mật khẩu camera | Cổng kiểm tra 3c (mục 19.5); không đạt thì dùng router có WireGuard (mục 18.2) hoặc đặt máy tại chỗ |
| Internet nhà yến rớt trong phiên đếm | Số đếm phiên đó thấp bất thường, thiếu vài bản ghi 5 phút | Đếm lại phiên đó từ file thẻ nhớ của camera; ghi nhận là hạn chế của kiến trúc đếm trên cloud |
| Giờ chim bay lệch khỏi khung giờ phiên theo mùa | Biểu đồ 5 phút cho thấy nhiều chim trước/sau khung giờ | Domain Expert đặt lịch đếm theo mùa hoặc khung tạm thời cho nhà yến (VISION-FR-019); `sessions` trong config chỉ là mặc định |
| Camera bị xê dịch | Vạch và ROI lệch khỏi lỗ | Gắn chặt; kiểm tra stream mỗi tuần |
| Chim lượn qua lại quanh vạch | Một con bị đếm nhiều lần | Dời vạch sâu vào trong lỗ, nơi chim chỉ bay một chiều |
| **Giờ bảo vệ không trùng giờ chim bay** (chim chỉ ra/vào lúc 05:30–07:00 và 17:30–19:00) | Hội đồng mở stream chỉ thấy lỗ trống | Chuẩn bị "camera demo" phát lại clip đã quay (mục 15.8) |
| Mạng nhà yến rớt đúng lúc demo | Video đứng hình | Camera demo chạy trên một máy khác có mạng ổn định; quay sẵn video màn hình làm phương án cuối |
| Mạng nơi bảo vệ chặn UDP | Trang tải được nhưng video đen | MediaMTX mở thêm WebRTC qua TCP (mục 15.5); thử trước bằng mạng của trường; dự phòng phát 4G |
| VPS hết RAM | Container bị khởi động lại | Dùng gói 4 GB; hoặc chuyển MongoDB sang Atlas gói miễn phí |
| TLS trên ESP32 không chạy ổn (thiếu RAM, lỗi bắt tay) | Thiết bị không lên ONLINE sau khi nạp bản `cloud` | Giới hạn 2 ngày; quá hạn thì dùng phương án lùi ở mục 15.7 |

---

## 14. Lịch và checklist

| Tuần | Việc |
|---|---|
| 1 | GĐ0, GĐ1; bắt đầu thu clip hằng ngày; thuê VPS, trỏ tên miền (GĐ-C bước 15.2) |
| 2 | GĐ2 (gán nhãn, train v1) song song GĐ3 (backend), GĐ4 (frontend) và GĐ-C (dựng cloud, đẩy video) |
| 3 | GĐ2 vòng cải thiện (v2), GĐ5 chạy thật qua cloud |
| 4 (nửa tuần) | GĐ6, dựng camera demo, tổng duyệt từ mạng ngoài |

GĐ-C ước lượng 3 ngày công. Nên dựng cloud xong **ít nhất 1 tuần trước ngày bảo vệ** để còn thời gian chạy thử qua mạng thật.

Phân công gợi ý: một người lo pipeline + model, một người lo backend + frontend, một người lo cloud; cả nhóm cùng gán nhãn.

Checklist:

- [ ] Camera lắp đúng vị trí, xem được RTSP
- [ ] CameraNode đã đăng ký, `.env` đủ giá trị
- [ ] `inference.py` đã sửa 4 chỗ (RGB, đọc cả hai kiểu đầu ra, class, số luồng/provider)
- [ ] `pytest` qua
- [ ] Stream có ô xanh, ROI và vạch đếm đã hiệu chỉnh
- [ ] FPS xử lý ≥ tốc độ khung hình của camera trên máy chạy thật (VPS)
- [ ] Clip của ít nhất 4 ngày
- [ ] 1.500+ ảnh đã gán nhãn, chia tập theo ngày
- [ ] Model v1 đã train, export ONNX, có số liệu trên tập test
- [ ] Đã so sánh YOLOv8n / YOLO11n / YOLO26n trên cùng dữ liệu, chọn theo mục 7.9
- [ ] Sai số đếm trên các clip test đạt ngưỡng, có bảng tách đủ sáng / thiếu sáng
- [ ] Backend: bản ghi được upsert, `return_rate` tính trên số ròng, `returnRate.job` tạo alert `LOW_RETURN_RATE`, test tích hợp qua
- [ ] Số đếm 5 phút: pipeline gửi cả ngoài phiên, backend lưu `BirdCountBucket`, có API và biểu đồ
- [ ] Camera: chim không phản ứng với đèn hồng ngoại (cổng 6); modem chỉ cho IP của VPS vào cổng camera (cổng 3c)
- [ ] Mobile xem được live stream có khung
- [ ] Camera chuyển ONLINE/OFFLINE đúng
- [ ] Frontend: stream thật, số live, hết mock
- [ ] Chạy 24 giờ ổn định, 6 tình huống lỗi đạt
- [ ] Cloud: HTTPS hoạt động, đăng nhập được từ 4G, không cổng quản trị nào lộ ra ngoài
- [ ] Cloud: video có ô xanh xem được từ 4G và từ mạng của trường
- [ ] Mật khẩu mặc định (Mongo, EMQX dashboard, tài khoản seed) đã đổi
- [ ] Camera demo phát lại clip chạy được
- [ ] Tổng duyệt đủ kịch bản demo từ mạng ngoài, có video quay màn hình dự phòng
- [ ] Báo cáo test, SRS, CLAUDE.md, README, BOM đã cập nhật

### Quyết định đã chốt

- Triển khai trên cloud, hội đồng xem từ xa → mục 15 là bắt buộc.
- Một người tự triển khai toàn bộ → ưu tiên ít thành phần, một file compose, một tên miền.
- VPS: dùng tín dụng sinh viên (GitHub Student Developer Pack), khu vực Singapore (mục 15.2).
- Tên miền: tên miền thật, lấy miễn phí qua gói sinh viên nếu còn ưu đãi.
- Mọi kết nối từ ngoài vào đều mã hóa: HTTPS (443), MQTT qua TLS (8883), đẩy video qua TLS (8322). Không mở cổng 1883 hay 8554 ra Internet.
- ESP32: cài TLS, có giới hạn thời gian và phương án lùi (mục 15.7).
- Nhà yến lắp cáp quang VNPT có IP public, camera IP có RTSP mua riêng và nối dây vào modem; VPS kéo hình thẳng từ camera (mục 19). Phương án 4G ở mục 17 không còn dùng.
- Không có máy dư để đặt tại nhà yến → thử chạy model trên cloud trước (mục 18), có 5 cổng kiểm tra; trượt thì quay về đặt máy tại chỗ.
- Model mặc định: **YOLO26n**, export ONNX `nms=False` (20/10/2026, thay YOLOv8n). Bản cuối chọn sau khi so với YOLOv8n và YOLO11n trên dữ liệu thật (mục 7.9). Cùng kích thước, nhanh hơn khoảng 2 lần trên CPU theo số liệu của Ultralytics (mục 6.1, 18.4). Mục tiêu xử lý **25 khung hình/giây**, bằng tốc độ thật của camera VIGI C320I (mục 19.3).

---

## 15. GĐ-C — Triển khai cloud

Thời gian: khoảng 3 ngày công. Chạy song song GĐ1–GĐ4; cần GĐ3 (backend) xong mới thử được video end-to-end.

Lưu ý phạm vi: phần này đưa **cả hệ thống** SwiftletCare lên cloud, không riêng module VISION. Repo hiện chưa có Dockerfile hay cấu hình production nào; `docker-compose.yml` ở gốc repo chỉ dành cho dev (mật khẩu mặc định, mở mọi cổng) và **không được dùng nguyên trạng trên máy chủ công khai**.

### 15.1. Thành phần trên VPS

| Service | Vai trò | Cổng mở ra Internet |
|---|---|---|
| Caddy | HTTPS tự động (Let's Encrypt); phục vụ frontend; chuyển `/api`, `/socket.io` vào backend | 80, 443 |
| tls-proxy (nginx) | Bọc TLS cho hai giao thức không phải HTTP, dùng lại chứng chỉ của Caddy | 8883 (MQTT), 8322 (đẩy video) |
| backend | API + Socket.io | không (đi qua Caddy) |
| MongoDB | Dữ liệu | không |
| EMQX | MQTT broker | không (đi qua tls-proxy); dashboard 18083 chỉ mở cho `127.0.0.1` |
| MediaMTX | Nhận video từ pipeline, phát WebRTC | 8189/udp + 8189/tcp (WebRTC, tự mã hóa); trang WHEP 8889 đi qua Caddy |

Không có cổng nào truyền dữ liệu dạng rõ được mở ra Internet.

Tên miền: `<tên miền>` cho ứng dụng, MQTT và đẩy video; `stream.<tên miền>` cho trang xem video. Cả hai trỏ về IP của VPS.

### 15.2. Chuẩn bị VPS

**Chọn nhà cung cấp** (theo thứ tự ưu tiên):

| Thứ tự | Lựa chọn | Lý do |
|---|---|---|
| 1 | GitHub Student Developer Pack (đăng ký bằng email `@fpt.edu.vn`) → tín dụng DigitalOcean, tạo Droplet 2 vCPU / 4 GB ở Singapore; tên miền miễn phí trong cùng gói | Không tốn tiền; Singapore gần Việt Nam nên video ít trễ |
| 2 | Azure for Students → máy ảo cỡ B2s ở Southeast Asia | Dùng khi không có thẻ để xác minh với DigitalOcean |
| 3 | VPS trả tiền của nhà cung cấp trong nước, 2 vCPU / 4 GB | Đường truyền trong nước tốt nhất; mất phí |

Ưu đãi sinh viên thay đổi theo thời gian — kiểm tra tại `education.github.com/pack` trước khi lên kế hoạch. Việc xét duyệt gói có thể mất vài ngày, nên **đăng ký ngay từ tuần 1**.

1. Tạo VPS Ubuntu 22.04/24.04 có IP công khai. Cỡ máy: **4 vCPU dedicated, 8 GB RAM** vì model đếm chim chạy trên chính VPS này (mục 18.4). Các dòng "2 vCPU / 4 GB" trong bảng trên chỉ đúng cho phương án lùi (model chạy tại nhà yến). Kiểm tra giá trước: cỡ máy này có thể dùng gần hết tín dụng sinh viên trong 1–2 tháng, nên chỉ nâng lên khi cần chạy thật và hạ xuống sau bảo vệ.
2. Trỏ hai bản ghi DNS loại A (`<tên miền>` và `stream.<tên miền>`) về IP đó.
3. Cài Docker:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER      # đăng xuất rồi đăng nhập lại
```

4. Tắt đăng nhập SSH bằng mật khẩu, chỉ dùng khóa SSH.
5. Mở cổng trên **tường lửa của nhà cung cấp VPS** (security group): 22, 80, 443, 8883, 8322 (TCP) và 8189 (TCP + UDP). Không mở gì khác.
6. Cài Tailscale trên PC nhà yến và máy của bạn, để điều khiển PC đó từ xa (Remote Desktop/SSH) mà không cần mở cổng router.

Lưu ý: cổng do Docker publish **không bị `ufw` chặn**. Thứ quyết định cổng nào lộ ra ngoài là mục `ports:` trong file compose và tường lửa của nhà cung cấp, không phải `ufw`.

### 15.3. Dockerfile và Compose

`backend/Dockerfile` (mới):

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ENV NODE_ENV=production
EXPOSE 3000
# Chạy bằng tsx giống `npm run dev` để alias `@/` chắc chắn hoạt động.
# Nếu đã kiểm tra `npm run build && npm start` chạy đúng với alias thì đổi sang cách đó.
CMD ["npx", "tsx", "src/index.ts"]
```

Build context là `backend/` nên file `docs/api/api-spec.yaml` không có trong image: Swagger UI sẽ tắt trên production (backend chỉ ghi cảnh báo, không lỗi).

`deploy/docker-compose.prod.yml` (mới):

```yaml
services:
  mongodb:
    image: mongo:7.0
    restart: unless-stopped
    environment:
      MONGO_INITDB_ROOT_USERNAME: ${MONGO_USER}
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_PASSWORD}
    volumes:
      - mongo_data:/data/db

  emqx:
    image: emqx/emqx:5.7.0
    restart: unless-stopped
    ports:
      - "127.0.0.1:18083:18083"      # dashboard: chỉ vào được qua SSH tunnel
      # 1883 không publish: thiết bị bên ngoài đi qua tls-proxy cổng 8883
    volumes:
      - emqx_data:/opt/emqx/data

  backend:
    build: ../backend
    restart: unless-stopped
    env_file: ./backend.env
    depends_on: [mongodb, emqx]

  mediamtx:
    image: bluenviron/mediamtx:latest   # khi triển khai: ghim một phiên bản cụ thể
    restart: unless-stopped
    environment:
      MTX_AUTHHTTPADDRESS: http://backend:3000/internal/stream-auth?key=${STREAM_AUTH_KEY}
      MTX_WEBRTCADDITIONALHOSTS: ${PUBLIC_IP}
    ports:
      # 8554 không publish: pipeline đẩy video qua tls-proxy cổng 8322
      - "8189:8189/udp"              # WebRTC
      - "8189:8189/tcp"              # WebRTC dự phòng khi mạng người xem chặn UDP
    volumes:
      - ./mediamtx.yml:/mediamtx.yml:ro
    depends_on: [backend]

  caddy:
    image: caddy:2
    restart: unless-stopped
    environment:
      DOMAIN: ${DOMAIN}
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - ../frontend/dist:/srv/frontend:ro
      - caddy_data:/data
    depends_on: [backend, mediamtx]

  # Bọc TLS cho MQTT và RTSP bằng chính chứng chỉ Caddy đã xin
  tls-proxy:
    image: nginx:alpine
    restart: unless-stopped          # lần đầu sẽ tự khởi động lại cho tới khi Caddy xin xong chứng chỉ
    ports:
      - "8883:8883"                  # MQTT qua TLS  → emqx:1883
      - "8322:8322"                  # RTSP qua TLS  → mediamtx:8554
    volumes:
      - ./tls-proxy.conf:/etc/nginx/nginx.conf:ro
      - caddy_data:/certs:ro
    depends_on: [caddy, emqx, mediamtx]

volumes:
  mongo_data:
  emqx_data:
  caddy_data:
```

`deploy/tls-proxy.conf` (mới) — thay `DOMAIN` bằng tên miền thật ở cả bốn chỗ:

```nginx
events {}

stream {
    ssl_certificate     /certs/caddy/certificates/acme-v02.api.letsencrypt.org-directory/DOMAIN/DOMAIN.crt;
    ssl_certificate_key /certs/caddy/certificates/acme-v02.api.letsencrypt.org-directory/DOMAIN/DOMAIN.key;

    server {                    # MQTT qua TLS: ESP32 và pipeline
        listen 8883 ssl;
        proxy_pass emqx:1883;
    }
    server {                    # RTSP qua TLS: pipeline đẩy video
        listen 8322 ssl;
        proxy_pass mediamtx:8554;
    }
}
```

- Đường dẫn chứng chỉ là nơi Caddy lưu mặc định; sau lần chạy đầu, kiểm tra lại bằng `docker compose exec caddy ls /data/caddy/certificates`.
- nginx chỉ đọc chứng chỉ lúc khởi động, còn Caddy tự gia hạn khoảng 2 tháng một lần. Thêm một dòng cron trên VPS để nạp lại hằng tuần:

```bash
0 4 * * 1  cd /path/to/repo && docker compose -f deploy/docker-compose.prod.yml restart tls-proxy
```

MinIO và Redis chưa có trong file này. Thêm vào (không publish cổng) nếu chức năng đang dùng cần đến, ví dụ tải file loa ru.

`deploy/.env` (không commit):

```dotenv
DOMAIN=<tên miền>
PUBLIC_IP=<IP của VPS>
MONGO_USER=swiftletcare
MONGO_PASSWORD=<mật khẩu mạnh>
STREAM_AUTH_KEY=<chuỗi ngẫu nhiên dài>
```

`deploy/backend.env` (không commit) — sao từ `backend/.env.example` rồi sửa các dòng sau:

```dotenv
NODE_ENV=production
MONGODB_URI=mongodb://swiftletcare:<mật khẩu>@mongodb:27017/swiftletcare?authSource=admin
MQTT_BROKER_URL=mqtt://emqx:1883
MQTT_USERNAME=backend-service
MQTT_PASSWORD=<mật khẩu mạnh>
CORS_ORIGIN=https://<tên miền>
TRUST_PROXY=1
JWT_ACCESS_SECRET=<chuỗi ngẫu nhiên dài>
JWT_REFRESH_SECRET=<chuỗi ngẫu nhiên dài khác>
STREAM_TOKEN_SECRET=<chuỗi ngẫu nhiên dài khác>
STREAM_AUTH_KEY=<giống deploy/.env>
STREAM_PUBLISH_SECRET=<chuỗi ngẫu nhiên dài khác>
RATE_LIMIT_MAX=300
```

- `TRUST_PROXY=1`: backend đứng sau Caddy; không đặt thì mọi người dùng bị tính chung một IP khi giới hạn tần suất.
- `RATE_LIMIT_MAX=300`: cả hội đồng có thể ra Internet bằng chung một IP; mức mặc định 100 request/phút dễ bị chạm.
- Tạo chuỗi ngẫu nhiên: `openssl rand -hex 32`.

Thêm vào `.gitignore`: `deploy/.env`, `deploy/backend.env`.

**Bật xác thực cho EMQX** (mặc định ai cũng kết nối được):

```bash
ssh -L 18083:localhost:18083 user@<IP VPS>     # rồi mở http://localhost:18083 trên máy mình
```

1. Đăng nhập dashboard (mặc định `admin` / `public`) và **đổi mật khẩu ngay**.
2. Access Control → Authentication → Create → Password-Based → Built-in Database.
3. Thêm người dùng: `backend-service`, `pipeline`, và một tài khoản cho các ESP32.

### 15.4. `deploy/Caddyfile`

```caddyfile
{$DOMAIN} {
	encode gzip

	# Endpoint nội bộ cho MediaMTX: không cho gọi từ Internet
	handle /api/internal/* {
		respond 404
	}
	# Giống proxy của Vite: bỏ tiền tố /api rồi chuyển vào backend
	handle_path /api/* {
		reverse_proxy backend:3000
	}
	handle /socket.io/* {
		reverse_proxy backend:3000
	}
	# Frontend (SPA)
	handle {
		root * /srv/frontend
		try_files {path} /index.html
		file_server
	}
}

stream.{$DOMAIN} {
	reverse_proxy mediamtx:8889
}
```

Vì cùng một tên miền và cùng các đường dẫn như lúc dev, frontend build ra không cần `VITE_API_URL` hay `VITE_WS_URL`. Chỉ cần `VITE_STREAM_URL=https://stream.<tên miền>`.

### 15.5. `deploy/mediamtx.yml`

```yaml
# Hỏi backend trước mỗi kết nối đẩy/xem. Địa chỉ thật được ghi đè bằng biến MTX_AUTHHTTPADDRESS.
authMethod: http
authHTTPAddress: http://backend:3000/internal/stream-auth

# Chỉ dùng RTSP (nhận) và WebRTC (phát)
rtmp: no
hls: no
srt: no

# WebRTC: IP công khai được ghi đè bằng MTX_WEBRTCADDITIONALHOSTS
webrtcLocalUDPAddress: :8189
webrtcLocalTCPAddress: :8189

paths:
  all_others:
```

Tên khóa cấu hình của MediaMTX thay đổi giữa các phiên bản. Sau khi ghim phiên bản, đối chiếu file này với `mediamtx.yml` mẫu của đúng phiên bản đó.

### 15.6. Pipeline: đẩy video và MQTT lên cloud

`src/stream_pusher.py` (mới):

```python
"""SwiftletCare – đẩy frame đã vẽ khung lên MediaMTX (H.264 qua RTSP) bằng ffmpeg.

Chạy ở luồng riêng với tốc độ khung cố định: mạng chậm hay rớt không làm chậm việc đếm.
"""
import subprocess
import threading
import time

import cv2
from loguru import logger


class StreamPusher(threading.Thread):
    def __init__(self, url: str, width: int, height: int, fps: int, bitrate: str):
        super().__init__(daemon=True)
        self._size, self._fps = (width, height), fps
        self._frame = None
        self._lock = threading.Lock()
        self._cmd = [
            "ffmpeg", "-loglevel", "error",
            "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{width}x{height}", "-r", str(fps), "-i", "-",
            "-an", "-c:v", "libx264", "-profile:v", "baseline",
            "-preset", "ultrafast", "-tune", "zerolatency",     # không B-frame: bắt buộc cho WebRTC
            "-pix_fmt", "yuv420p", "-g", str(fps * 2),
            "-b:v", bitrate, "-maxrate", bitrate, "-bufsize", bitrate,
            "-f", "rtsp", "-rtsp_transport", "tcp", url,
        ]

    def update(self, frame) -> None:
        with self._lock:
            self._frame = frame

    def run(self):
        proc, interval = None, 1 / self._fps
        while True:
            t0 = time.time()
            with self._lock:
                frame = self._frame
            if frame is not None:
                if proc is None or proc.poll() is not None:
                    proc = subprocess.Popen(self._cmd, stdin=subprocess.PIPE)
                try:
                    proc.stdin.write(cv2.resize(frame, self._size).tobytes())
                except OSError:
                    logger.warning("Mất kết nối máy chủ video, thử lại sau 3 giây")
                    proc.kill()
                    proc = None
                    time.sleep(3)
            time.sleep(max(0.0, interval - (time.time() - t0)))
```

Thay đổi trong `src/stream.py`:

```python
from stream_pusher import StreamPusher

# trong main(), sau khi tạo MjpegServer:
pusher = None
if os.getenv("STREAM_PUSH_URL"):
    p = cfg["push"]
    pusher = StreamPusher(os.environ["STREAM_PUSH_URL"], p["width"], p["height"], p["fps"], p["bitrate"])
    pusher.start()

# trong vòng lặp, thay dòng server.publish(...):
annotated = draw(frame.copy(), tracks, counter, (rx1, ry1, rx2, ry2), fps, session)
server.publish(annotated, frame)
if pusher:
    pusher.update(annotated)
```

Cấu hình trên PC nhà yến:

```yaml
# config.yaml
mqtt:
  broker: "<tên miền>"
  port: 8883
  tls: true
```

```dotenv
# .env
MQTT_USERNAME=pipeline
MQTT_PASSWORD=<mật khẩu đã tạo trên EMQX>
STREAM_PUSH_URL=rtsps://pipeline:<STREAM_PUBLISH_SECRET>@<tên miền>:8322/cam-<device_id>
```

Cả hai kết nối đều được mã hóa. Đường video dùng `rtsps://` tới tls-proxy, proxy gỡ TLS rồi chuyển RTSP thường cho MediaMTX trong mạng nội bộ Docker. Cách ghép này cần được thử ngay khi dựng xong (bước 7 ở mục 15.9); nếu `ffmpeg` không đẩy được qua proxy thì chuyển sang bật RTSPS trực tiếp trên MediaMTX (`rtspEncryption` + chứng chỉ của Caddy).

### 15.7. ESP32 và broker trên cloud

Phần này nằm ngoài module VISION nhưng bị ảnh hưởng trực tiếp khi lên cloud:

- Firmware tìm broker bằng mDNS trong LAN. Lên cloud thì mDNS không còn tác dụng; phải nhập tên miền của VPS qua captive portal, hoặc đặt trong `Secrets.h`.
- Firmware hiện chỉ kết nối cổng **1883 không TLS** (TLS chưa được cài đặt trong `MQTTManager.cpp`), trong khi VPS không mở cổng 1883.

**Phương án đã chọn: cài TLS cho firmware, giới hạn 2 ngày công.** Lần thử trước lỗi vì chứng chỉ tự ký của EMQX dev; lần này broker dùng chứng chỉ Let's Encrypt thật qua tls-proxy nên điều kiện đã khác.

Thêm một môi trường build riêng để bản dev trong LAN (1883 + mDNS) vẫn dùng được:

```ini
; platformio.ini
[env:cloud]
extends = env:esp32dev
build_flags = ${env:esp32dev.build_flags} -DMQTT_TLS
```

```cpp
// config/Config.h — thay dòng #define MQTT_PORT 1883
#ifdef MQTT_TLS
#define MQTT_PORT 8883
#else
#define MQTT_PORT 1883
#endif
```

```cpp
// mqtt/MQTTManager.cpp
#ifdef MQTT_TLS
#include <WiFiClientSecure.h>
#include "config/RootCA.h"            // LETSENCRYPT_ROOT_CA: PEM của ISRG Root X1 và X2
static WiFiClientSecure wifiClient;
#else
static WiFiClient wifiClient;
#endif

// trong hàm khởi tạo MQTT, trước lần connect đầu tiên:
#ifdef MQTT_TLS
  wifiClient.setCACert(LETSENCRYPT_ROOT_CA);   // KHÔNG dùng setInsecure()
#endif

// trong resolveBrokerViaMdns(): bản cloud kết nối theo tên miền, bỏ qua mDNS
#ifdef MQTT_TLS
  return false;
#endif
```

Những điểm cần lưu ý khi làm:

- `Config::mqttBroker` phải là **tên miền** (không phải IP), vì chứng chỉ được kiểm theo tên. Đặt trong `Secrets.h` hoặc nhập qua captive portal.
- Tải PEM gốc từ `letsencrypt.org/certificates`, đưa cả ISRG Root X1 và X2 vào `RootCA.h`.
- Kiểm chứng chỉ cần đồng hồ đúng. Firmware đã gọi `configTime()` với NTP; phải chắc NTP đồng bộ xong trước lần kết nối MQTT đầu tiên, nếu chưa thì chờ rồi thử lại.
- Bắt tay TLS tốn thêm vài chục KB heap. In `ESP.getFreeHeap()` trước và sau khi kết nối để kiểm tra.
- Mật khẩu MQTT của ESP32 (`SECRET_MQTT_PASSWORD`) phải khớp tài khoản đã tạo trên EMQX.
- Khi TLS chạy ổn, sửa hoặc gỡ khối `#error SWIFTLETCARE_PRODUCTION_BUILD` trong `Config.h` cho đúng thực tế mới.

**Xong khi:** nạp bản `pio run -e cloud --target upload`, thiết bị lên ONLINE trên dashboard cloud, telemetry chạy liên tục 1 giờ, lệnh relay từ web tới được thiết bị.

**Phương án lùi** nếu hết 2 ngày mà TLS chưa ổn: thêm dòng `- "1883:1883"` vào service `emqx` và mở cổng 1883 trên tường lửa, ESP32 dùng bản dev với tên miền VPS. Khi đó mật khẩu MQTT và dữ liệu cảm biến của ESP32 đi dạng rõ trên Internet; SEC-NFR-001 chưa đạt và phải nêu trong phần hạn chế của báo cáo. Pipeline và người dùng vẫn đi đường mã hóa.

### 15.8. Camera demo: phát lại clip

Chim chỉ bay ra/vào lúc 05:30–07:00 và 17:30–19:00. Nếu hội đồng xem vào giờ khác, camera thật chỉ cho thấy lỗ trống. Vì vậy cần một camera thứ hai phát lại clip đã quay, chạy pipeline thật trên clip đó.

1. Đăng ký thêm một CameraNode, ví dụ `cam-demo`, vào một Zone riêng tên "Demo" (để số đếm giả không lẫn vào dữ liệu thật).
2. Thêm cờ phát đúng tốc độ thật vào `frames()` trong `stream.py`, vì chế độ file mặc định chạy nhanh hết mức:

```python
ap.add_argument("--realtime", action="store_true", help="phát file đúng tốc độ thật (cho camera demo)")

# trong frames(source, live, realtime=False), nhánh đọc file:
fps = cap.get(cv2.CAP_PROP_FPS) or 25
next_t = time.time()
while True:
    ok, frame = cap.read()
    if not ok:
        return
    yield frame
    if realtime:
        next_t += 1 / fps
        time.sleep(max(0.0, next_t - time.time()))
```

3. Chạy lặp trên một máy có mạng ổn định (không nhất thiết ở nhà yến), với `.env` riêng của camera demo:

```powershell
while ($true) { python src/stream.py --source clips/demo_evening.mp4 --session EVENING_ENTRY --realtime }
```

Trong buổi bảo vệ, nói rõ với hội đồng đây là clip phát lại qua đúng pipeline thật, và mở thêm camera thật để chứng minh hệ thống đang chạy trực tiếp.

### 15.9. Trình tự triển khai và kiểm tra

```bash
# Trên máy dev: build frontend
cd frontend && VITE_STREAM_URL=https://stream.<tên miền> npm run build

# Đưa code lên VPS (git clone) và chép frontend/dist lên, rồi trên VPS:
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env up -d --build
docker compose -f deploy/docker-compose.prod.yml logs -f backend
docker compose -f deploy/docker-compose.prod.yml exec backend npm run seed   # chỉ lần đầu
```

Sau khi seed: **đổi mật khẩu các tài khoản seed** trước khi đưa đường link cho ai.

Sao lưu dữ liệu hằng ngày (một dòng cron trên VPS, giữ 7 bản gần nhất):

```bash
0 3 * * *  mkdir -p ~/backup && cd /path/to/repo && . deploy/.env && docker compose -f deploy/docker-compose.prod.yml exec -T mongodb mongodump -u "$MONGO_USER" -p "$MONGO_PASSWORD" --authenticationDatabase admin --archive --gzip > ~/backup/mongo-$(date +\%u).gz
```

Thứ tự làm cho một người (mỗi dòng là một buổi làm việc):

1. Đăng ký gói sinh viên, tạo VPS, trỏ tên miền, cài Docker (15.2).
2. Dựng compose với Caddy + backend + MongoDB + EMQX, đạt bước kiểm tra 1–5.
3. Thêm tls-proxy + MediaMTX, nối pipeline, đạt bước 6–9.
4. Firmware TLS cho ESP32 (15.7).
5. Camera demo (15.8), thử từ mạng của trường (bước 10).

Kiểm tra theo thứ tự (mỗi bước phải đạt mới làm bước sau):

| # | Kiểm tra | Cách làm | Đạt khi |
|---|---|---|---|
| 1 | HTTPS + frontend | Mở `https://<tên miền>` bằng 4G | Có ổ khóa, hiện trang đăng nhập |
| 2 | API + cookie refresh | Đăng nhập, chờ quá 15 phút rồi thao tác tiếp | Không bị đẩy ra trang đăng nhập |
| 3 | Socket.io | Mở dashboard, xem tab Network | Kết nối `socket.io` ở trạng thái 101 |
| 4 | Cổng nội bộ không lộ | Từ máy ngoài: `nc -zv <IP>` lần lượt với `27017`, `18083`, `3000`, `1883`, `8554` | Không cổng nào kết nối được |
| 5 | Endpoint nội bộ bị chặn | `curl -X POST https://<tên miền>/api/internal/stream-auth` | Trả 404 |
| 6 | MQTT từ pipeline | Chạy pipeline với cấu hình cloud | Camera chuyển ONLINE, có bản ghi đếm |
| 7 | Đẩy video | Log MediaMTX | Có dòng báo đường `cam-<device_id>` đang được publish |
| 8 | Chặn xem không token | `curl -X POST https://stream.<tên miền>/cam-<device_id>/whep` | Trả 401 |
| 9 | Xem video | Mở trang Vision bằng 4G | Thấy hình có ô xanh, trễ dưới khoảng 1–2 giây |
| 10 | Mạng nơi bảo vệ | Lặp lại bước 9 bằng Wi-Fi của trường | Xem được; nếu không, chuẩn bị phát 4G |

Checklist ngày bảo vệ:

- [ ] Hôm trước: chạy lại đủ 10 bước kiểm tra trên.
- [ ] PC nhà yến đang bật, pipeline đang chạy, camera thật ONLINE trên dashboard.
- [ ] Camera demo đang phát lặp clip.
- [ ] Có người trực tại nhà yến hoặc truy cập từ xa được vào PC đó (ví dụ Tailscale + Remote Desktop).
- [ ] Điện thoại phát 4G dự phòng cho máy trình chiếu.
- [ ] Video quay màn hình toàn bộ kịch bản demo, lưu sẵn trên máy.
- [ ] Sau bảo vệ: tắt VPS hoặc hủy gói để không phát sinh phí.

---

## 16. Hai chế độ chạy: dev và deploy

Cùng một bộ code chạy được ở cả hai chế độ; chỉ khác file cấu hình và biến môi trường. Không có nhánh code riêng cho từng chế độ, nên thứ đã chạy đúng ở dev sẽ chạy y như vậy trên cloud.

Quy trình: làm và thử mọi thứ ở **dev** trước (nhanh, không tốn tiền, không cần Internet), rồi mới đưa lên **deploy**.

### 16.1. So sánh

| Thành phần | Dev (trên laptop / trong LAN) | Deploy (cloud) |
|---|---|---|
| Mục đích | Viết code, hiệu chỉnh, train, kiểm thử | Chạy thật, hội đồng xem từ xa |
| Chi phí | 0đ | VPS + tên miền (0đ nếu có gói sinh viên) |
| Ai xem được | Máy của bạn; thiết bị cùng Wi-Fi nếu cấu hình IP LAN | Bất kỳ đâu có Internet |
| Nguồn hình | File clip, camera trong LAN, hoặc camera tại nhà yến kéo từ xa qua IP public (mục 16.6) | Camera tại nhà yến + camera demo |
| Hạ tầng | `docker-compose.yml` ở gốc repo + `npm run dev` | `deploy/docker-compose.prod.yml` |
| Frontend | Vite `http://localhost:5173` | Caddy `https://<tên miền>` |
| Backend | `npm run dev` trên máy, cổng 3000 | Container, sau Caddy |
| MQTT | `mqtt://localhost:1883`, không TLS, không mật khẩu | `<tên miền>:8883`, TLS, có mật khẩu |
| Video | MediaMTX chạy bằng Docker trên máy; hoặc chỉ dùng MJPEG `:8090` | MediaMTX trên VPS, đẩy qua `rtsps` cổng 8322 |
| ESP32 | `pio run -e esp32dev`, tìm broker bằng mDNS (`npm run mdns`) | `pio run -e cloud`, TLS tới tên miền |
| Bảo mật | Không có — **không bao giờ mở ra Internet** | HTTPS/TLS toàn bộ, mật khẩu mạnh |

### 16.2. Ba mức dev

Chọn mức thấp nhất đủ cho việc đang làm:

| Mức | Chạy những gì | Dùng khi |
|---|---|---|
| 0 — chỉ pipeline | `python src/stream.py --source <clip> --session MORNING_EXIT --no-mqtt`, xem `http://127.0.0.1:8090/stream` | Hiệu chỉnh ROI/vạch đếm, thử model, đo sai số (GĐ1, GĐ2) |
| 1 — có số đếm | Thêm `docker compose up -d mongodb emqx` và backend + frontend `npm run dev`; bỏ `--no-mqtt` | Làm backend và số đếm live (GĐ3, một phần GĐ4) |
| 2 — đủ video | Thêm MediaMTX và `STREAM_PUSH_URL` | Làm phần xem video trên frontend (GĐ4), tổng duyệt trước khi lên cloud |

### 16.3. Cấu hình dev

Thêm service MediaMTX vào `docker-compose.yml` ở gốc repo (dùng chung `deploy/mediamtx.yml` với bản cloud):

```yaml
  mediamtx:
    image: bluenviron/mediamtx:latest
    container_name: swiftletcare-mediamtx
    restart: unless-stopped
    environment:
      # backend chạy trên máy host bằng `npm run dev`
      MTX_AUTHHTTPADDRESS: http://host.docker.internal:3000/internal/stream-auth?key=dev-auth-key
      MTX_WEBRTCADDITIONALHOSTS: 127.0.0.1     # đổi thành IP LAN của laptop nếu muốn xem từ điện thoại cùng Wi-Fi
    ports:
      - "8554:8554"        # pipeline đẩy RTSP
      - "8889:8889"        # trang WHEP cho trình duyệt
      - "8189:8189/udp"    # WebRTC
    volumes:
      - ./deploy/mediamtx.yml:/mediamtx.yml:ro
```

`backend/.env` (thêm):

```dotenv
STREAM_TOKEN_SECRET=dev-token-secret
STREAM_AUTH_KEY=dev-auth-key
STREAM_PUBLISH_SECRET=dev-publish
```

`frontend/.env.development` (thêm):

```dotenv
VITE_STREAM_URL=http://localhost:8889
```

`ai-pipeline/.env` (dev):

```dotenv
CAMERA_DEVICE_ID=cam-zone1-01
FARM_ID=...
HOUSE_ID=...
# bỏ dòng này nếu chỉ chạy mức 0 hoặc 1
STREAM_PUSH_URL=rtsp://pipeline:dev-publish@localhost:8554/cam-cam-zone1-01
```

`ai-pipeline/config/config.yaml` giữ giá trị dev (`broker: localhost`, `port: 1883`, `tls: false`), đúng như mục 6.2.

Chạy đủ mức 2:

```powershell
docker compose up -d mongodb emqx mediamtx
cd backend;  npm run dev          # cửa sổ 1
cd frontend; npm run dev          # cửa sổ 2
cd ai-pipeline; python src/stream.py --source clips/20261008_morning_01.mp4 --session MORNING_EXIT --realtime   # cửa sổ 3
# mở http://localhost:5173 → trang Vision
```

### 16.4. Cấu hình deploy

Toàn bộ nằm ở mục 15. Trên PC nhà yến, tách cấu hình cloud ra file riêng để không sửa đè file dev:

| File | Dev | Deploy |
|---|---|---|
| Cấu hình pipeline | `config/config.yaml` | `config/config.cloud.yaml` (sao từ file dev, đổi khối `mqtt` theo mục 15.6 và `camera.tiles`/`camera.mask`/`tracking.ring` theo camera thật) |
| Biến môi trường pipeline | `.env` | `.env` trên PC nhà yến (mục 15.6) |
| Lệnh chạy | `python src/stream.py` | `python src/stream.py --config config/config.cloud.yaml` |
| Backend env | `backend/.env` | `deploy/backend.env` |
| Frontend env | `frontend/.env.development` | `VITE_STREAM_URL` truyền lúc `npm run build` |
| Firmware | `pio run -e esp32dev` | `pio run -e cloud` |

Task Scheduler ở GĐ5 (mục 10) dùng lệnh có `--config config/config.cloud.yaml`.

### 16.5. Điều kiện để chuyển từ dev lên deploy

Chỉ đưa lên cloud khi mức 2 ở dev đã đạt đủ:

- [ ] `pytest` (pipeline) và test backend qua.
- [ ] Trang Vision trên `localhost:5173` hiện video có ô xanh qua MediaMTX, không phải MJPEG.
- [ ] Số vào/ra trên trang khớp với số vẽ trong video.
- [ ] Tắt pipeline thì camera chuyển OFFLINE; bật lại thì ONLINE và đếm tiếp.
- [ ] Mở WHEP không kèm token bị từ chối (401).

Lỗi xuất hiện trên cloud mà không có ở dev gần như chắc chắn nằm ở hạ tầng (DNS, chứng chỉ, tường lửa, biến môi trường), không nằm ở code — kiểm tra theo bảng 10 bước ở mục 15.9.

### 16.6. Dev từ xa: kéo hình camera nhà yến về laptop

Nhà yến ở xa nên thu clip và chạy thử pipeline đều làm từ laptop ở nhà, không đặt máy nào tại nhà yến. Laptop đóng đúng vai trò VPS sau này: kéo RTSP qua IP public của modem (mục 19.4). Train vẫn trên Colab (mục 7.5), không phụ thuộc chỗ ngồi.

**Phải làm tại nhà yến (một lần, lúc lắp):** lắp và ngắm camera (mục 3.3), các việc ở mục 19.2, mở cổng RTSP và DDNS ở mục 19.4. Không mở cổng quản trị modem hay camera ra Internet để chỉnh từ xa. Sau đó chỉ phải quay lại khi camera bị lệch, cần chỉnh góc hoặc mất kết nối không tự hồi phục.

**Cho laptop vào được cổng camera:** nếu modem lọc IP nguồn (cổng 3c), thêm IP mạng nhà bạn vào luật. IP nhà thường là IP động; khi đổi thì phải sửa luật, và sửa luật cần vào trang quản trị modem tại chỗ. Nếu tạm mở cổng cho mọi nơi trong giai đoạn dev: mật khẩu camera mạnh, cổng ngoài không mặc định, cập nhật firmware camera, và ghi là hạn chế trong báo cáo. Hình trên đường này không mã hóa.

**Giữ mật khẩu ngoài repo:** lưu địa chỉ RTSP vào biến môi trường của Windows, không ghi vào file trong repo:

```powershell
setx CAM_URL "rtsp://USER:PASS@<IP public hoặc tên DDNS>:18554/<đường dẫn rtsp>"   # mở cửa sổ PowerShell mới để có biến
ffplay -rtsp_transport tcp $env:CAM_URL                                              # kiểm tra: thấy hình, góc đúng
python src/stream.py --source $env:CAM_URL --session MORNING_EXIT --no-mqtt          # chạy pipeline với hình thật
```

**Thu clip theo lịch:** đường truyền qua Internet có thể rớt giữa phiên; `ffmpeg` dừng khi rớt, nên ghi bằng vòng lặp ghi tiếp sang file mới cho tới hết giờ. `-timeout` (micro giây) để `ffmpeg` thoát thay vì treo khi luồng đứng hình. Lưu file này ngoài repo hoặc trong `ai-pipeline/tools/`, chạy trong thư mục `ai-pipeline`:

```powershell
# record_session.ps1 — ghi 90 phút, tên file theo quy ước ở mục 7.1
$end = (Get-Date).AddMinutes(90); $i = 1
$session = if ((Get-Date).Hour -lt 12) { 'morning' } else { 'evening' }
while ((Get-Date) -lt $end) {
  $left = [int]($end - (Get-Date)).TotalSeconds
  $out  = "clips/{0:yyyyMMdd}_{1}_{2:d2}.mp4" -f (Get-Date), $session, $i
  ffmpeg -n -rtsp_transport tcp -timeout 10000000 -i $env:CAM_URL -c copy -t $left $out
  $i++; Start-Sleep -Seconds 10
}
```

Đặt Task Scheduler chạy script lúc 05:25 và 17:25, tick "Wake the computer to run this task" và tắt chế độ ngủ khi cắm sạc; laptop phải bật và có mạng trong giờ chim bay. Sau mỗi phiên kiểm tra nhanh bằng `ffprobe`: tổng thời lượng các file gần đủ 90 phút. Nhiều file ngắn liền nhau nghĩa là đường truyền chập chờn — cùng dấu hiệu sẽ gặp ở cổng 3b khi lên VPS.

Nếu camera có thẻ nhớ ghi liên tục, đó là bản dự phòng khi đường truyền rớt; nhưng lấy file thẻ nhớ phải tới nhà yến hoặc tải qua app.

---

## 17. Nhà yến dùng 4G và máy tính tại chỗ

> **Không còn là cấu hình hiện hành.** Nhà yến đã chuyển sang cáp quang VNPT có IP public (mục 19). Mục này giữ lại làm phương án lùi và để tham khảo.

Phương án ban đầu: nhà yến không lắp Internet cố định, dùng router 4G.

### 17.1. Vì sao vẫn cần một máy tính tại nhà yến

> Cập nhật: nhóm không có máy dư, nên phương án **chạy model trên cloud** ở [mục 18](#18-phương-án-ưu-tiên-chạy-model-trên-cloud-không-đặt-máy-tại-nhà-yến) được thử trước. Mục 17 này là phương án lùi nếu mục 18 không qua được cổng kiểm tra. Bảng dưới đây nêu các trở ngại mà mục 18 phải vượt qua.

| Cách khác | Vì sao không dùng |
|---|---|
| Camera tự gửi hình lên VPS, VPS chạy model | Camera IP phổ thông chỉ cho máy khác *kéo* hình qua RTSP, không tự đẩy đi; mạng 4G lại không cho kết nối từ ngoài vào. Vẫn phải có một thiết bị tại chỗ để chuyển tiếp |
| Chạy model trên VPS | VPS 2 vCPU không có GPU không đủ nhanh; phải tải toàn bộ video gốc lên 4G cả ngày, tốn dung lượng gấp nhiều lần |
| Lấy hình từ app của hãng camera | Hệ thống đóng, không lấy ra được |

Máy tại chỗ cũng là thứ giữ cho việc đếm **không phụ thuộc mạng**: 4G rớt thì vẫn đếm, có mạng lại thì gửi bù.

### 17.2. Không cần mua PC để hoàn thành KLTN

Máy đặt cố định chỉ cần khi muốn hệ thống chạy thật 24/7. Từng việc trong plan cần gì:

| Việc | Cần máy tại nhà yến? | Cách làm |
|---|---|---|
| Thu clip để train (GĐ2) | Không | Camera ghi vào thẻ microSD, định kỳ lấy thẻ về chép clip. Hoặc mang laptop tới ghi bằng `ffmpeg` vài buổi |
| Viết code, train, đo sai số | Không | Chạy trên clip, trên laptop của bạn (dev mức 0–2) |
| Demo cho hội đồng: ô xanh + số đếm live | Không | Camera demo phát lại clip qua pipeline thật (mục 15.8), chạy từ laptop ở bất kỳ đâu có mạng |
| Demo camera thật đang trực tiếp | Có, nhưng chỉ vài ngày | Đặt tạm một laptop tại nhà yến trong các ngày chạy thử và ngày bảo vệ |
| Vận hành thật lâu dài | Có, cố định | Laptop cũ hoặc PC cũ |

Nếu cần máy đặt lại, **laptop cũ là lựa chọn tốt nhất**: thường có sẵn nên không tốn tiền, pin đóng vai trò lưu điện khi mất điện ngắn, tốn ít điện hơn PC. Cấu hình tối thiểu: CPU 4 nhân, RAM 8 GB. Nhớ tắt chế độ ngủ khi gập máy.

### 17.3. Thiết bị mạng

| Thành phần | Yêu cầu |
|---|---|
| Router 4G | Có cổng LAN (cắm camera và máy tính bằng dây) và phát Wi-Fi (cho ESP32) |
| SIM | Gói dữ liệu theo ngày hoặc tháng, xem bảng dung lượng bên dưới |
| Vị trí | Đặt nơi sóng tốt; thử tốc độ upload tại chỗ trước, cần ổn định từ khoảng 2 Mbps |

Mạng 4G không cho kết nối từ ngoài vào, nhưng thiết kế này không cần: mọi kết nối đều đi từ nhà yến ra (mục 1). Điều khiển máy từ xa dùng Tailscale (mục 15.2).

Tắt tính năng lưu video lên cloud trong app của hãng camera, nếu không nó sẽ âm thầm dùng dung lượng 4G.

### 17.4. Dung lượng và chế độ đẩy video theo yêu cầu

| Dữ liệu | Dung lượng |
|---|---|
| Số đếm, heartbeat (MQTT), dữ liệu ESP32 | Không đáng kể (vài chục MB mỗi tháng) |
| Video 1,5 Mbps đẩy 24/7 | Khoảng 16 GB mỗi ngày — không khả thi với 4G |
| Video 0,8 Mbps chỉ khi có người xem | Khoảng 0,36 GB cho mỗi giờ xem |

Vì vậy với 4G, pipeline **chỉ đẩy video khi có người đang mở trang xem**. Không ai xem thì không tốn dung lượng; hội đồng mở lúc nào cũng xem được, kể cả ngoài giờ chim bay.

Cách hoạt động:

```
Người xem mở trang ─► frontend gọi GET …/stream-token (lặp lại mỗi 60 giây khi còn xem)
                        │
                        ▼
                   backend kiểm quyền, cấp token, đồng thời publish MQTT
                   swiftletcare/{farm}/{house}/{zone}/vision/stream-request  {deviceId}
                        │
                        ▼
                   pipeline nhận lệnh ─► đẩy video trong 120 giây kể từ lệnh gần nhất
                        │
                        ▼
                   hết người xem ─► không còn lệnh ─► pipeline tự ngừng đẩy
```

Cấu hình (`config.cloud.yaml`):

```yaml
push:
  on_demand: true          # false = đẩy liên tục (khi có Internet cố định)
  hold_sec: 120
  width: 960
  height: 540
  fps: 12
  bitrate: "800k"
```

Thay đổi trong `src/stream_pusher.py`:

```python
def __init__(self, url, width, height, fps, bitrate, on_demand=False):
    ...
    self._on_demand = on_demand
    self._until = 0.0                    # đẩy tới thời điểm này

def request(self, seconds: float) -> None:
    """Có người đang xem: tiếp tục đẩy thêm `seconds` giây."""
    self._until = time.time() + seconds

# đầu vòng lặp trong run():
if self._on_demand and time.time() > self._until:
    if proc is not None:                 # hết người xem → ngắt ffmpeg, ngừng tốn dung lượng
        proc.kill()
        proc = None
    time.sleep(0.5)
    continue
```

Thay đổi trong `Publisher` (`src/stream.py`) — nhận lệnh từ backend:

```python
def __init__(self, cfg, model_version, on_stream_request=None):
    ...
    topic = f"{base}/vision/stream-request"

    def on_connect(client, userdata, flags, reason_code, properties):
        client.subscribe(topic, qos=1)   # đăng ký lại sau mỗi lần nối lại

    def on_message(client, userdata, msg):
        try:
            target = json.loads(msg.payload).get("deviceId")
        except ValueError:
            return
        if on_stream_request and target == self.device_id:
            on_stream_request()

    self.client.on_connect = on_connect
    self.client.on_message = on_message

# trong main():
p = cfg["push"]
pub = Publisher(cfg["mqtt"], m["version"],
                on_stream_request=lambda: pusher and pusher.request(p["hold_sec"]))
```

Backend: trong `issueStreamToken` (mục 8.6), sau khi kiểm quyền, publish `{ deviceId }` lên topic `…/vision/stream-request` của zone đó. Dùng lại đúng cách publish mà lệnh relay đang dùng (lấy chuỗi farm/house/zone qua `findZoneChainOrThrow`), và thêm topic vào `docs/api/api-spec.yaml` nếu spec có liệt kê topic MQTT.

Frontend, bổ sung vào `useWhepStream` (mục 9):

- Gọi lại `getStreamToken` mỗi 60 giây khi component còn hiển thị, để pipeline tiếp tục đẩy.
- Lần mở đầu tiên, video cần vài giây để bắt đầu được đẩy lên. Nếu yêu cầu WHEP trả 404, chờ 1 giây rồi thử lại, tối đa khoảng 15 giây, trong lúc đó hiện "Đang kết nối camera…".
- Dừng gọi khi tab bị ẩn (`document.visibilityState`), để một tab bỏ quên không ngốn dung lượng 4G.

**Xong khi:** không ai mở trang thì log pipeline không còn dòng đẩy video và lưu lượng 4G gần như bằng 0; mở trang thì video hiện trong vòng khoảng 10 giây; đóng trang 2 phút thì pipeline ngừng đẩy.

Ở dev, đặt `on_demand: false` để không phải bận tâm tới cơ chế này khi làm các phần khác.

---

## 18. Phương án ưu tiên: chạy model trên cloud, không đặt máy tại nhà yến

Đã chốt: nhóm không có máy dư để đặt tại nhà yến, nên **thử phương án này trước**. Nếu không qua được các cổng kiểm tra ở mục 18.6 thì quay về phương án đặt máy tại chỗ (các mục 6, 15, 17 giữ nguyên giá trị).

Mức độ chắc chắn (tra cứu tháng 10/2026): từng mảnh ghép đều có tài liệu hoặc người dùng xác nhận chạy được, nhưng **cả hệ thống ghép lại chưa được ai trong nhóm chạy thử**. Hai điểm không thể khẳng định trên giấy là tốc độ suy luận trên VPS và độ chính xác đếm khi video đi qua 4G. Vì vậy phương án này đi kèm cổng kiểm tra có/không, làm sớm và rẻ.

### 18.1. Kiến trúc

```
NHÀ YẾN                                   CLOUD (VPS)
───────                                   ───────────
Camera ──RTSP──► thiết bị chuyển tiếp ──4G──► MediaMTX  đường "cam-<id>-raw" (hình gốc)
                 (không chạy model)              │
                                                 ▼
                                    pipeline (container trên VPS)
                                    YOLO → ByteTrack → đếm → vẽ ô xanh
                                       │                    │
                                       ▼ MQTT nội bộ        ▼ đẩy lại MediaMTX, đường "cam-<id>"
                                    backend              người xem (WebRTC)
```

Code pipeline không đổi: nguồn hình vẫn là một địa chỉ RTSP, chỉ khác là nó chạy trên VPS và đọc từ MediaMTX thay vì đọc thẳng từ camera.

### 18.2. Đưa video gốc từ nhà yến lên VPS

Camera không tự đẩy video đi, và 4G không cho kết nối từ ngoài vào, nên vẫn cần **một thiết bị chuyển tiếp** — nhưng nó chỉ chuyển gói tin, không chạy model, nên không cần là máy tính.

| Cách | Bằng chứng tra được | Chi phí | Rủi ro |
|---|---|---|---|
| **A. Router 4G có WireGuard** (dòng chạy OpenWrt, ví dụ GL.iNet): router nối VPN ra VPS, VPS kéo RTSP từ camera qua đường hầm | Có hướng dẫn và người dùng xác nhận truy cập camera sau CGNAT theo đúng cách này | Router loại này đắt hơn router 4G thường; **có thể ngang giá một máy tính cũ** — phải kiểm tra giá trước | Thấp nhất: không có phần mềm nào phải tự giữ cho chạy |
| **B. Điện thoại Android cũ + Termux + `ffmpeg`**: điện thoại kéo RTSP trong LAN rồi đẩy lên VPS, không nén lại | Termux có gói `ffmpeg` và lệnh `termux-wake-lock` để chạy nền | 0đ nếu có máy cũ | **Android có thể tự tắt tiến trình chạy nền** dù đã bật wake-lock và tắt tối ưu pin; đã có báo cáo lỗi về việc này. Phải thử nhiều ngày |
| **C. Camera tự đẩy RTMP** | Một số mẫu Dahua có; không thống nhất giữa các mẫu, và có báo cáo lỗi tương thích | Tùy mẫu | Không chắc mẫu mua được có hỗ trợ; không khuyến nghị dựa vào |

Chọn A nếu giá router chấp nhận được, chọn B nếu có sẵn điện thoại cũ. Nếu router loại A đắt ngang máy tính cũ thì **mua máy tính cũ vẫn tốt hơn**: đếm không phụ thuộc mạng và tốn ít dung lượng 4G hơn nhiều.

Cách A — cấu hình MediaMTX trên VPS kéo hình khi cần:

```yaml
# deploy/mediamtx.yml
paths:
  cam-<device_id>-raw:
    source: rtsp://TAIKHOAN:MATKHAU@192.168.8.50:554/stream1   # IP LAN của camera, đi qua WireGuard
    sourceOnDemand: yes        # chỉ kéo khi pipeline đang đọc → không tốn 4G lúc không đếm
  all_others:
```

Trên router bật "Remote Access LAN" và tắt "IP Masquerading" cho kết nối WireGuard; trên VPS thêm dải LAN của nhà yến vào `AllowedIPs` của peer. Tên khóa `source*` cần đối chiếu với phiên bản MediaMTX đang dùng.

Cách B — chạy trong Termux trên điện thoại:

```bash
pkg install ffmpeg
termux-wake-lock
while true; do
  ffmpeg -rtsp_transport tcp -i "rtsp://TAIKHOAN:MATKHAU@192.168.1.64:554/stream1" \
         -an -c copy -f rtsp -rtsp_transport tcp \
         "rtsps://pipeline:<STREAM_PUBLISH_SECRET>@<tên miền>:8322/cam-<device_id>-raw"
  sleep 5        # rớt mạng thì tự nối lại
done
```

Tắt tối ưu pin cho Termux, cắm sạc liên tục, và cài Termux:Boot để tự chạy lại sau khi điện thoại khởi động.

Cài đặt camera cho cả hai cách: **H.264** (không phải H.265), 1080p, 25 khung hình/giây (camera đã mua chạy được 25, mục 19.3), bitrate cố định khoảng 2 Mbps.

### 18.3. Chạy pipeline trên VPS

`ai-pipeline/Dockerfile` (mới):

```dockerfile
FROM python:3.11-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["python", "src/stream.py", "--config", "config/config.vps.yaml"]
```

Thêm vào `deploy/docker-compose.prod.yml`:

```yaml
  vision:
    build: ../ai-pipeline
    restart: unless-stopped
    environment:
      CAMERA_RTSP_URL: rtsp://pipeline:${STREAM_PUBLISH_SECRET}@mediamtx:8554/cam-${CAMERA_DEVICE_ID}-raw
      STREAM_PUSH_URL: rtsp://pipeline:${STREAM_PUBLISH_SECRET}@mediamtx:8554/cam-${CAMERA_DEVICE_ID}
      CAMERA_DEVICE_ID: ${CAMERA_DEVICE_ID}
      FARM_ID: ${FARM_ID}
      HOUSE_ID: ${HOUSE_ID}
      MQTT_USERNAME: pipeline
      MQTT_PASSWORD: ${PIPELINE_MQTT_PASSWORD}
    volumes:
      - ../ai-pipeline/models:/app/models:ro
    depends_on: [mediamtx, emqx]
```

`config/config.vps.yaml`: sao từ `config.yaml`, đổi `mqtt.broker: emqx`, `port: 1883`, `tls: false` (mạng nội bộ Docker), `stream.host: 127.0.0.1`.

Thay đổi ở backend (`authorizeStream`, mục 8.6): cho phép **đọc** bằng mật khẩu dịch vụ, để pipeline lấy được hình gốc; người dùng vẫn không xem được đường `-raw` vì token chỉ cấp cho `cam-<id>`:

```ts
if (body.action === 'read' && body.password && body.password === process.env.STREAM_PUBLISH_SECRET) return
```

Trạng thái camera vẫn đúng: pipeline chỉ gửi heartbeat khi nhận được khung hình, nên mất đường truyền từ nhà yến thì camera tự chuyển OFFLINE trên dashboard.

### 18.4. Cỡ VPS và tốc độ suy luận

**Mục tiêu:** xử lý kịp **25 khung hình/giây**. Đây là tốc độ thật của camera VIGI C320I, đã kiểm tra 20/10/2026. Như vậy mỗi khung có **40 ms** cho toàn bộ: giải mã video vào, crop ROI, suy luận, ByteTrack, vẽ khung và nén video đẩy lại MediaMTX. Riêng phần suy luận phải nhanh hơn 40 ms một khoảng rõ ràng.

Số liệu công bố của Ultralytics, đầu vào 640, chạy ONNX trên CPU (Intel Xeon 2,0 GHz):

| Model | Thời gian mỗi khung | Tương đương |
|---|---|---|
| YOLOv8n | 80,4 ms | khoảng 12 khung hình/giây |
| YOLO11n | 56,1 ms | khoảng 18 khung hình/giây |
| **YOLO26n** (`nms=False`) | **38,9 ms** | khoảng 25 khung hình/giây |

Ngay cả YOLO26n ở đầu vào 640 cũng dùng gần hết 40 ms, chưa tính phần giải mã và nén video. VPS dùng chung còn thường chậm hơn máy đo chuẩn. Vì vậy cấu hình 2 vCPU ở mục 15 không đủ, và phải áp dụng thêm các bước dưới.

Cách đạt tốc độ, áp dụng theo thứ tự. Bước nào không tốn tiền làm trước. Dừng ngay khi đạt cổng 1 (mục 19.5):

1. **YOLO26n, export `nms=False`.** Đây là mặc định của plan từ 20/10/2026 (mục 6.1, 7.5).
2. **CPU Intel thì dùng OpenVINO.** Áp dụng cho VPS chạy Xeon, hoặc laptop/PC i5 cũ ở phương án lùi. Cài `onnxruntime-openvino` thay cho `onnxruntime`, rồi đặt `model.providers: ["OpenVINOExecutionProvider", "CPUExecutionProvider"]`. Vẫn dùng đúng file `.onnx` cũ, không phải sửa code. Ultralytics công bố OpenVINO nhanh hơn tới khoảng 3 lần trên CPU. Mức tăng khi chạy qua ONNX Runtime thì phải tự đo. Xem dòng `providers:` trong log để chắc OpenVINO đã được dùng.
3. **Giảm đầu vào xuống 480 hoặc 416** trên vùng ROI hẹp. Khối lượng tính giảm khoảng 1,8 lần (480) hoặc 2,4 lần (416). Phải train và export lại với cùng `imgsz`, đổi `model.input_size` cho khớp, rồi kiểm tra chim vẫn ≥ khoảng 15 px trong ảnh đầu vào (cổng 5) và sai số đếm vẫn đạt (cổng 2).
4. Dùng VPS **4 vCPU loại dedicated, 8 GB RAM**. Nếu đặt máy tại chỗ thì cần CPU từ 4 nhân.
5. Phương án cuối: **hạ camera xuống 20 khung hình/giây** và đặt `box_pad: 3.0` (mục 19.3). Không suy luận cách khung: chim bay nhanh, bỏ khung thì ByteTrack mất dấu, cũng giống như hạ FPS nhưng khó kiểm soát hơn.

`camera.fps` trong config luôn phải bằng tốc độ thật của luồng RTSP, đọc bằng `ffprobe` hoặc trong app VIGI mục Luồng. ByteTrack dùng con số này để tính thời gian giữ dấu.

Thuê GPU theo giờ là phương án cuối, vì phát sinh chi phí hằng ngày.

### 18.5. Những cái giá của phương án này

| Hạng mục | Đặt máy tại chỗ | Chạy trên cloud |
|---|---|---|
| Dung lượng 4G | Gần như chỉ khi có người xem | Video gốc phải lên cloud suốt hai phiên đếm: khoảng 2 Mbps × 3 giờ ≈ **2,7 GB mỗi ngày, khoảng 80 GB mỗi tháng** |
| Mạng rớt giữa phiên | Vẫn đếm đủ | **Mất khung hình là mất chim**; số đếm phiên đó thấp hơn thực tế |
| VPS | 2 vCPU / 4 GB | 4 vCPU dedicated / 8 GB, đắt hơn rõ rệt |
| Xem trực tiếp ngoài giờ đếm | Có, theo yêu cầu | Cách A: có (kéo khi cần). Cách B: chỉ khi điện thoại đang đẩy |

### 18.6. Cổng kiểm tra có/không

Làm theo thứ tự. Trượt cổng nào thì dừng và chuyển sang đặt máy tại chỗ.

| Cổng | Khi nào làm | Cách kiểm tra | Đạt khi | Chi phí để thử |
|---|---|---|---|---|
| 1. Tốc độ VPS | Ngay khi có VPS và model tạm | Chạy container `vision` với một clip (`--source clips/x.mp4 --no-mqtt`), đọc dòng FPS trong log trong lúc backend và MediaMTX cũng đang chạy | FPS ≥ tốc độ khung hình của camera, ổn định trong 10 phút | Vài giờ thuê VPS |
| 2. Độ chính xác ở cấu hình giảm | Sau khi có model v1 | Trên laptop, đo sai số đếm (mục 7.7) với đúng `imgsz` và tốc độ khung hình đã chọn ở cổng 1 | Sai số ≤ 10% | 0đ |
| 3. Thiết bị chuyển tiếp | Một buổi tại nhà yến | Cho thiết bị chuyển tiếp chạy liên tục | Cách A: 24 giờ không rớt. Cách B: **3 ngày** không bị Android tắt | Một buổi đi lại |
| 4. Ảnh hưởng của 4G tới số đếm | Cùng lúc cổng 3 | Camera đồng thời ghi phiên đó vào thẻ nhớ. Về nhà chạy pipeline trên file thẻ nhớ, so với số đếm cloud của cùng phiên | Chênh lệch ≤ 5% trong ít nhất 3 phiên | 0đ |
| 5. Dung lượng 4G | Cùng lúc cổng 3 | Xem lưu lượng trên router sau một ngày | Nằm trong gói cước đã mua | Tiền gói cước |

Cổng 1 và 2 không cần ra nhà yến và không cần mua gì, nên làm trước. Nếu hai cổng này trượt thì không cần mua thiết bị chuyển tiếp.

Cổng 4 cũng là số liệu tốt cho báo cáo: nó đo trực tiếp việc đưa suy luận lên cloud làm mất bao nhiêu độ chính xác.

### 18.7. Phương án lùi

Nếu trượt bất kỳ cổng nào: đặt một máy tính cũ tại nhà yến và chạy đúng container/chương trình đó tại chỗ, theo các mục 6, 15.6 và 17. Những gì đã làm cho phương án cloud vẫn dùng lại được: model, pipeline, backend, frontend, MediaMTX và toàn bộ hạ tầng VPS (chỉ bỏ service `vision` và đường `-raw`, và hạ VPS về 2 vCPU).

---

## 19. Cấu hình đã chốt: Internet VNPT có IP public + camera IP nối dây

Đã chốt (08/10/2026): nhà yến lắp cáp quang **VNPT**, nhà mạng xác nhận cấp được **IP public**. VNPT không tặng kèm camera, nên camera mua riêng (mục 3.2, 19.3). Mục này thay cho phần 4G ở mục 17 và thay cho thiết bị chuyển tiếp ở mục 18.2.

### 19.1. Thay đổi so với các mục trước

| Hạng mục | Trước | Bây giờ |
|---|---|---|
| Internet nhà yến | Router 4G | Cáp quang VNPT, IP public |
| Đưa video lên VPS | Thiết bị chuyển tiếp (router WireGuard / điện thoại) | **VPS kéo thẳng RTSP từ camera** qua cổng mở trên modem — không cần thiết bị nào thêm |
| Dung lượng | Khoảng 80 GB/tháng là vấn đề | Không giới hạn |
| Camera | Chưa chọn | Camera IP có RTSP, mua riêng, cấp nguồn PoE và nối dây LAN vào modem (mục 3.2, 19.3) |
| Máy tính tại nhà yến | Cần, hoặc thử cloud | Không có; model chạy trên VPS (mục 18) |

Tại nhà yến chỉ còn: modem VNPT, camera, các ESP32.

```
Camera ──LAN──► modem VNPT (IP public, mở 1 cổng về camera) ──Internet──► VPS
                                                                 MediaMTX kéo RTSP ─► pipeline ─► web
```

### 19.2. Việc làm trong ngày lắp mạng

| # | Việc | Đạt khi |
|---|---|---|
| 1 | Xin thợ lắp tài khoản quản trị modem (hoặc xem nhãn dưới modem) | Đăng nhập được trang cấu hình |
| 2 | So sánh **WAN IP** trong modem với IP hiện trên trang "what is my IP" | Hai địa chỉ giống nhau. Nếu WAN IP bắt đầu bằng `100.64`–`100.127`, `10.` hoặc `192.168.` thì chưa phải IP public → gọi tổng đài yêu cầu chuyển, lý do "mở port camera" |
| 3 | Hỏi IP là động hay tĩnh | Biết để chọn cách ở mục 19.4 |
| 4 | Đo tốc độ upload ngay tại vị trí đặt camera | Từ khoảng 10 Mbps |
| 5 | Đi dây LAN từ modem qua bộ cấp PoE tới vị trí camera | Camera lên nguồn và hiện trong danh sách thiết bị của modem |
| 6 | Trong modem, gán IP LAN cố định cho camera (DHCP reservation) | Camera luôn nhận cùng một IP |
| 7 | Cho các ESP32 vào Wi-Fi mới qua captive portal | ESP32 lên ONLINE |

### 19.3. Camera: kiểm tra và cài đặt

Camera là loại camera IP mua riêng, đạt các yêu cầu ở mục 3.2, cấp nguồn PoE và nối dây LAN vào modem (không dùng Wi-Fi).

Các bước kiểm tra (khoảng 30 phút, laptop cắm cùng modem với camera):

1. Tìm IP của camera trong danh sách thiết bị của modem (hoặc bằng công cụ của hãng). Vào trang quản trị của camera, đổi mật khẩu thành mật khẩu riêng, mạnh; bật RTSP và ONVIF nếu đang tắt.
2. Chạy **ONVIF Device Manager** (miễn phí, Windows). Nếu thấy camera và hiện địa chỉ `rtsp://…` thì dùng được.
3. Xem hình và đọc thông số:

```powershell
ffplay  -rtsp_transport tcp "<địa chỉ rtsp>"
ffprobe -rtsp_transport tcp "<địa chỉ rtsp>"     # ghi lại: H.264 hay H.265, độ phân giải, fps
```

4. Ghi thử một clip 5 phút đúng giờ chim bay (lệnh ở mục 7.1) để xem chim có đủ lớn và đủ rõ không.

Cài đặt bắt buộc:

- **Tắt mọi chế độ tự xoay/bám theo chuyển động nếu có.** Camera tự xoay thì ROI và vạch đếm sai hết.
- **Tắt báo động khi phát hiện chuyển động, đàm thoại và mọi âm báo.** Tiếng động trong nhà yến làm chim hoảng.
- Chọn luồng chính, độ phân giải cao nhất, **H.264**, 25 khung hình/giây, bitrate cố định (CBR) khoảng 2 Mbps.
- **Tần số dòng điện 50 Hz** (điện Việt Nam). Để 60 Hz thì hình có sọc nhấp nháy dưới đèn.
- Nếu có khe thẻ nhớ: bật ghi **liên tục** vào thẻ microSD (dùng cho cổng 4).

Giá trị cho camera đã mua, **TP-Link VIGI C320I**, chỉnh được ngay trong app VIGI trên điện thoại:

| Mục trong app | Giá trị |
|---|---|
| Video & Hiển thị → Luồng → Chủ đạo | 1920×1080, 25 fps, **CBR**, 2048 Kbps, H264 |
| Luồng phụ | Giữ mặc định (848×480, 25 fps, CBR 512 Kbps, H264), chỉ để xem nhanh |
| Tần số dòng điện | 50Hz (mặc định là 60Hz) |
| Khung thông minh, WDR, HLC, Mặt nạ riêng tư | Tắt (khung thông minh vẽ lên hình gốc) |
| Phát hiện (người, phương tiện, chuyển động, xâm nhập…) | Tắt hết |
| Cài đặt OSD | Giữ ngày giờ, bỏ tên camera; đặt ở góc xa lỗ ra vào |
| Địa chỉ IP | Để DHCP, gán IP cố định bằng DHCP reservation trên modem (mục 19.2) |

Đã kiểm tra 20/10/2026, trong LAN ở nhà, bằng VLC trên điện thoại: `rtsp://admin:<mật khẩu>@<IP>:554/stream1` (luồng chính) xem được, 1920×1080, 25 fps, H264. Độ trễ khoảng 1–1,5 giây, phần lớn là bộ đệm khoảng 1 giây của VLC. Luồng phụ là `/stream2`.

Cấu hình pipeline (`config.vps.yaml`): `camera.fps` phải bằng tốc độ khung hình thật của camera (đọc bằng `ffprobe` ở bước 3, hoặc trong app mục Luồng). Với VIGI C320I đặt như trên thì `camera.fps: 25` và giữ `box_pad: 2.5`. Chỉ khi phải hạ camera xuống 20 khung hình/giây (bước 5 ở mục 18.4) mới nới box tracking:

```yaml
camera:
  fps: 20
tracking:
  box_pad: 3.0            # 20 khung hình/giây → nới box nhiều hơn mặc định 2.5
```

### 19.4. Cho VPS kéo hình từ camera

**Bước 1 — mở cổng trên modem.** Tạo một luật NAT port (port forwarding):

| Trường | Giá trị |
|---|---|
| Cổng ngoài | Một cổng không mặc định, ví dụ `18554` |
| IP trong | IP LAN cố định của camera |
| Cổng trong | Cổng RTSP của camera (thường `554`; lấy từ địa chỉ ở mục 19.3) |
| Giao thức | TCP |

Chỉ mở cổng RTSP. **Không mở cổng ONVIF hay cổng quản trị** của camera.

**Bước 2 — địa chỉ để VPS tìm nhà yến.**

| Trường hợp | Cách làm |
|---|---|
| IP tĩnh | Dùng thẳng IP đó |
| IP động, modem có mục DDNS | Đăng ký một tên DDNS miễn phí, điền vào modem |
| IP động, modem không có DDNS | Cho một ESP32 gọi định kỳ URL cập nhật của dịch vụ DDNS (một yêu cầu HTTPS đơn giản), hoặc mua IP tĩnh |

**Bước 3 — MediaMTX trên VPS kéo hình khi pipeline cần:**

```yaml
# deploy/mediamtx.yml
paths:
  cam-<device_id>-raw:
    source: rtsp://TAIKHOAN:MATKHAU@<IP hoặc tên DDNS của nhà yến>:18554/<đường dẫn rtsp của camera>
    sourceOnDemand: yes
  all_others:
```

Pipeline đọc đường `-raw` liên tục cả ngày (để có số đếm 5 phút ngoài phiên), nên trên thực tế MediaMTX kéo hình 24/7; `sourceOnDemand` chỉ giúp ngừng kéo khi container `vision` dừng.

Tài khoản và mật khẩu camera nằm trong file này, nên **không commit file thật**; commit bản mẫu `mediamtx.yml.example` và thêm `deploy/mediamtx.yml` vào `.gitignore`. Tên khóa `source*` cần đối chiếu với phiên bản MediaMTX đang dùng.

Kiểm tra từ VPS trước khi nối pipeline:

```bash
ffprobe -rtsp_transport tcp "rtsp://TAIKHOAN:MATKHAU@<địa chỉ nhà yến>:18554/<đường dẫn>"
```

**Bảo mật của cổng đã mở** — đây là điểm yếu nhất của cấu hình này:

- Nếu modem có lọc theo IP nguồn: chỉ cho IP của VPS vào cổng đó. Đây là cách đúng.
- Nếu modem không lọc được: cổng camera lộ ra toàn Internet. Giảm rủi ro bằng cổng không mặc định, mật khẩu ONVIF/RTSP mạnh và riêng, cập nhật firmware camera; và **ghi rõ là hạn chế trong báo cáo**. Hình ảnh trên đường này không mã hóa.
- Nếu không chấp nhận rủi ro đó: quay về thiết bị chuyển tiếp ở mục 18.2 (router có WireGuard), khi đó không cần mở cổng nào.

### 19.5. Cổng kiểm tra (thay bảng ở mục 18.6)

| Cổng | Cách kiểm tra | Đạt khi | Trượt thì |
|---|---|---|---|
| 1. Tốc độ VPS | Như mục 18.6, với video đúng tốc độ khung hình của camera | FPS xử lý ≥ tốc độ khung hình của camera, ổn định 10 phút | Áp dụng lần lượt các bước ở mục 18.4; vẫn trượt → đặt máy tại chỗ |
| 2. Sai số ở cấu hình giảm | Như mục 18.6, đo với clip của chính camera này | Sai số ≤ 10% | Tăng tốc độ khung hình của camera lên 25–30; vẫn trượt → xem lại cách lắp |
| 3a. Camera có RTSP | Mục 19.3 | Xem được hình bằng `ffplay` trong LAN | Mua camera có RTSP |
| 3b. VPS kéo được hình | `ffprobe` từ VPS (mục 19.4), rồi để MediaMTX kéo liên tục | 24 giờ không rớt quá vài lần, tự nối lại | Kiểm tra IP public, DDNS, NAT port; không được → thiết bị chuyển tiếp |
| 4. Ảnh hưởng đường truyền tới số đếm | So số đếm cloud với số đếm chạy trên file thẻ nhớ của cùng phiên | Chênh ≤ 5% trong ít nhất 3 phiên | Kiểm tra tốc độ upload của đường mạng, hạ bitrate; vẫn trượt → đặt máy tại chỗ |
| 3c. Modem lọc được IP nguồn | Tạo luật chỉ cho IP của VPS vào cổng camera, rồi thử `ffprobe` từ một mạng khác | Từ VPS vào được, từ mạng khác **không** vào được | Dùng router có WireGuard (mục 18.2) hoặc đặt máy tại chỗ; nếu vẫn mở cổng cho mọi nơi thì phải ghi rõ là hạn chế bảo mật trong báo cáo |
| 5. Chất lượng hình cho việc đếm | Xem clip thử: kích thước chim trong ROI | Chim ≥ khoảng 15 px mỗi chiều, không nhòe thành vệt dài | Đưa camera lại gần lỗ; hoặc đổi camera |
| 6. Chim không phản ứng với đèn hồng ngoại | Hỏi người nuôi yến trước khi lắp; sau khi lắp, quan sát vài phiên chiều lúc đèn IR bật (chim có né cửa, lượn lâu hơn không) và so số chim về với các ngày trước khi lắp nếu có | Người nuôi yến đồng ý và không thấy thay đổi hành vi | Tắt IR (chấp nhận đếm kém lúc tối), hoặc đổi camera IR 940 nm |

Cổng 3a, 5, 6 làm ngay ngày lắp mạng và các ngày đầu sau khi lắp. Cổng 1, 2 làm khi có VPS và model tạm. Cổng 3b, 3c, 4 làm sau khi mở cổng modem.

### 19.6. Những gì không còn áp dụng

- Mục 17.3, 17.4 (router 4G, giới hạn dung lượng): không dùng 4G nữa. Cơ chế "đẩy video theo yêu cầu" vẫn nên bật (`on_demand: true`) để VPS không phải nén video khi không ai xem, nhưng không còn là chuyện dung lượng.
- Mục 18.2, các cách A/B/C (thiết bị chuyển tiếp): chỉ còn là phương án lùi khi không dùng được IP public hoặc không chấp nhận mở cổng.
- Mục 18.5, dòng "Dung lượng 4G": không còn.
- Mục 15.7: ESP32 nối Wi-Fi của modem VNPT; phần TLS giữ nguyên.

### 19.7. Kết quả lắp đặt ngày 20/10/2026

Lắp camera và cấu hình modem tại nhà yến thử nghiệm, làm bằng điện thoại và laptop. Repo **không ghi** IP public của modem, mật khẩu camera hay tài khoản modem. Các giá trị đó để ngoài repo, giống địa chỉ RTSP ở mục 16.6.

**Vị trí camera.** Nhà có phòng lượn ở tầng trên cùng. Lỗ ra vào nằm trên tường phòng lượn, có một ống dẫn ngắn; chim từ phòng lượn xuống các tầng làm tổ qua lỗ thông tầng. Camera VIGI C320I gắn trong phòng lượn, nhìn chéo vào miệng ống dẫn. Miệng lỗ nằm về phía phải khung hình, phần còn lại của khung là tường phòng lượn. Tường có rất nhiều vết phân đen, nên lúc gán nhãn cần nhiều ảnh âm của nền tường (mục 7.3). Chưa xem được chim bay qua với góc này, nên vạch đếm và ROI chốt sau khi có clip phiên chiều.

**Modem VNPT.** Giao diện web tại `192.168.1.1` (menu Device / WAN / LAN / Wireless / Advance / Tools / Management). Model chưa ghi lại.

| Hạng mục | Kết quả | Chỗ cài trong modem |
|---|---|---|
| WAN | Hai đường: `veip0.4000` (TR069, IPoE, IP `10.x`, là đường quản lý của VNPT, bỏ qua) và **`veip0.10` (Internet, PPPoE)** | Device → WAN Info |
| IP public | **Có.** IPv4 của `veip0.10` trùng IP trên trang "What Is My IP" | Device → WAN Info |
| IP tĩnh hay động | **Chưa biết.** PPPoE thường cấp IP động. Kiểm tra bằng cách rút điện modem rồi so WAN IP; nếu đổi thì cài DDNS (mục 19.4 bước 2) | — |
| DHCP | Dải `192.168.1.2`–`192.168.1.254`, thời hạn 24 giờ. Giữ nguyên | LAN → IPv4 → IPv4 Setup |
| IP cố định cho camera | MAC `5c:62:8b:5c:d1:b9` → **`192.168.1.163`**. Đã thêm; xác nhận lại sau lần rút điện thử | LAN → IPv4 → Static IP lease |
| Mở cổng | `cam-rtsp`: cổng ngoài **18554**, TCP → `192.168.1.163:554`, WAN `veip0.10`. Không dùng DMZ Host | Advance → NAT Forwarding → Virtual Servers Setup |
| Lọc IP nguồn | Màn hình Virtual Servers **không có** ô IP nguồn. Cổng đang mở cho mọi nơi, chỉ mật khẩu camera bảo vệ. Còn phải xem mục Advance → Security khi có IP của VPS | — |

**Camera.** Cài theo bảng ở mục 19.3: luồng chính 1920×1080, 25 fps, CBR 2048 Kbps, H.264; 50 Hz; các mục Phát hiện tắt. App báo "Không có thiết bị lưu trữ nội bộ": camera chưa có thẻ microSD, nên chưa có bản ghi dự phòng cho cổng 4.

**Đã kiểm tra:**

| Kiểm tra | Cách làm | Kết quả |
|---|---|---|
| RTSP trong LAN (cổng 3a) | App VIGI và VLC qua Wi-Fi modem | Đạt |
| Cổng mở từ ngoài Internet | Laptop dùng điểm phát 4G của điện thoại (IP nguồn `172.20.10.x`, không đi qua modem), chạy `Test-NetConnection <WAN IP> -Port 18554` | `TcpTestSucceeded : True` |
| Xem hình từ ngoài Internet | Cũng laptop đó, VLC mở `rtsp://admin:<mật khẩu>@<WAN IP>:18554/stream1` | Có hình, xem liên tục khoảng 40 giây không giật |

Kéo hình qua Internet đã chạy, nhưng mới thử ngắn. **Cổng 3b** (kéo liên tục 24 giờ, tự nối lại) chưa làm.

**Còn lại:**

- [ ] Rút điện modem và bộ PoE: camera lên lại đúng `192.168.1.163`, xem qua 4G vẫn được, ghi WAN IP có đổi không
- [ ] IP động thì cài DDNS (mục 19.4)
- [x] ~~Clip phiên chiều để chốt ROI và vạch đếm~~ — camera đã đổi góc ngày 21/10, xem mục 19.8
- [ ] Đèn hồng ngoại lúc chạng vạng: hình có trắng xóa không, chim có né lỗ không (cổng 6)
- [ ] Lắp thẻ microSD nếu camera có khe, bật ghi liên tục (cổng 4)
- [ ] Có VPS: giới hạn cổng 18554 chỉ cho IP của VPS nếu modem hỗ trợ (cổng 3c), rồi cho MediaMTX kéo liên tục 24 giờ (cổng 3b)

### 19.8. Đổi góc camera ngày 21/10/2026: nhìn vào miệng lỗ, đếm bằng vòng

**Vị trí mới.** Camera vẫn trong phòng lượn, đổi sang nhìn xuống miệng lỗ ra vào ngoài trời. Miệng lỗ là một hộp gỗ chữ nhật nhô vào phòng, nằm hơi lệch trên giữa khung hình. Ban ngày miệng hộp sáng trắng vì ánh trời xuyên qua (xác nhận đây là lỗ thông ra ngoài), nên chim qua lỗ hiện thành bóng tối trên nền sáng. Chim chui qua lỗ gần như theo hướng nhìn của camera rồi tỏa đi mọi hướng, nên đếm bằng **vòng đếm** quanh miệng lỗ (mục 3.3, ý 7), không dùng một vạch thẳng.

**Đo trên khung 1920×1080 lấy từ RTSP lúc 18:30** (phóng to 3 lần trên lưới 20 px, sai số khoảng ±3 px):

| | Viền ngoài hộp gỗ (px) | Vòng đếm = viền nới 60 px (tỉ lệ) |
|---|---|---|
| 1 | (793, 287) góc trên trái | (0.379, 0.228) |
| 2 | (985, 220) góc trên xa | (0.527, 0.136) |
| 3 | (1042, 313) góc phải | (0.575, 0.277) |
| 4 | (1037, 362) chân phải | (0.569, 0.374) |
| 5 | (848, 439) chân trước | (0.427, 0.477) |
| 6 | (800, 343) chân trái | (0.386, 0.334) |

ROI `[0.25, 0.00, 0.75, 0.70]` (960×756 px): cách vòng đếm 150–340 px, ngoài dòng ngày giờ. Camera trong nhà nên trong vòng là phía ngoài trời: `into_ring_is_exit: true` (chui vào lỗ = RA, chui ra khỏi lỗ = VỀ). Các giá trị đã ghi vào `ai-pipeline/config/config.yaml`.

**Chưa chốt:** khoảng nới 60 px và ROI là số chọn tay. Clip 90 giây quay lúc 18:35 **không có chim yến**; mọi vật chuyển động trong đó là côn trùng hoặc bụi bay sát ống kính, sáng trắng và nhòe dưới đèn hồng ngoại, cỡ 20–40 px, ngang cỡ một con chim. Cần clip có chim (phiên sáng 05:30–07:00 là tốt nhất) để đo `s`, `v` rồi tính lại theo mục 6.8.

**Ảnh lệch giữa ngày và đêm.** Khung lúc 18:30 dịch đều khoảng 16 px theo chiều dọc so với ảnh app lúc 13:45. Mức dịch đo riêng ở hộp gỗ, góc xà và tường phải đều như nhau, còn dòng ngày giờ in trên hình vẫn đứng yên. Vậy hình ảnh thật sự đã dịch: hoặc camera nghiêng nhẹ sau khi lắp, hoặc do chuyển chế độ ngày/đêm. Từ 18:30 đến 18:42 lệch 0 px. Mức 16 px nhỏ hơn khoảng nới 60 px nên không làm sai việc đếm.

**Còn lại:**

- [x] Lấy một khung RTSP ban ngày, so với khung 18:30 — xong 22/10, xem bên dưới: camera đứng yên, không cần nới vòng
- [ ] Clip có chim: đo `s`, `v`, chạy lại `tools/pick_roi.py --margin`, chốt `roi` và `ring` (cổng 5)
- [ ] Gán clip côn trùng dưới IR làm ảnh âm khi gán nhãn (mục 7.3)

**Kiểm tra ngày 22/10/2026.**

- *Camera đứng yên.* Khung RTSP 12:44 so với khung đêm 21/10 18:30: cả khung lệch khoảng 1 px, góc xà và tường phải khoảng 3 px. Đổi chế độ ngày/đêm không làm hình dịch, nên 16 px ở trên là camera xê dịch một lần sau ảnh app 13:45 (hoặc do app hiển thị khác luồng RTSP). Viền hộp gỗ đo ban đêm vẫn khớp hộp trên ảnh ban ngày; miệng lỗ sáng nằm trọn trong vòng đếm. `roi` và `ring` giữ nguyên.
- *Clip phiên sáng `20261022_morning_01.mp4` (05:15–07:15) có chim, nhưng chim qua lỗ chỉ là vệt mờ 1–2 khung.* Chim ra rộ khoảng 05:19–05:36 (cao nhất 05:25–05:31). Camera ở chế độ IR (ảnh xám) tới 05:50:37 mới sang chế độ ngày (dùng để chia clip đủ sáng / thiếu sáng, VISION-FR-016).
  - Chim lượn trong phòng thấy rõ: cỡ 25–40 px, dời 20–35 px mỗi khung (vd. khung 10840–10861, 05:22). Nhiều con lượn **ngoài ROI** (sát tường trái x < 480, sàn y > 756) và có con bay sát ống kính thành vệt ~180 px, dời ~190 px mỗi khung.
  - Chim qua miệng lỗ: vệt trong suốt rộng ~45 px, dài ~200 px, dời ~150–200 px mỗi khung, chỉ thấy 1–2 khung (khung 18661–18662: vệt đi ngang miệng hộp rồi lên phía trên hộp; khung 17631: vệt tối trong hộp). Ảnh IR phơi sáng gần hết thời gian một khung (~40 ms ở 25 fps) nên chim nhanh bị nhòe thành vệt.
  - Hai cách quét tự động đầu tiên (tách nền trong ROI, độ sáng miệng lỗ) đều bỏ sót: lọc bỏ đốm > 200 px và vệt trong suốt gần như không đổi độ sáng trung bình. Quét khe sáng ở đáy hộp chỉ bắt được 2 lần che khe.
- *Hệ quả cho cách đếm:* `d = max(s, 1,5v)` với v ~150–200 px ra khoảng nới ~300 px, gần bằng cả ROI; và một con chỉ có 1–2 lần phát hiện thì ByteTrack chưa kịp có id. Vòng đếm 60 px hiện tại không đếm được chim qua lỗ ở tốc độ này. Hướng thử, theo thứ tự: (1) giảm thời gian phơi sáng của camera (cài trong app/web của hãng, mục 3.2, 19.3) để vệt ngắn và rõ hơn, kiểm tra ảnh IR lúc chạng vạng còn đủ sáng; (2) quay lại clip và đo lại s, v; (3) nếu vẫn chỉ thấy 1–2 khung thì chuyển sang đếm theo vùng quanh miệng lỗ (mục 3.3 ý 6) với hướng lấy từ vệt hoặc khung kề.

**Quyết định 22/10: theo dõi cả khung, đếm ở miệng lỗ.** Bám mọi con chim (ô xanh), kể cả đang lượn, để con chim có id từ trước khi lao vào lỗ.

- **Vùng theo dõi = cả khung**, chia 2 ô chồng nhau 160 px (`x 0–1040` và `880–1920`), mỗi ô thu về 640: tỉ lệ 0,59, chim lượn 25–40 px còn 15–24 px (cổng 5), chi phí khoảng 2× một lần suy luận. Không chọn đầu vào 960 (chim còn 12–20 px) hay 1280 (chậm ~4×). Ô trùng ở dải chồng được gộp theo phần giao / ô nhỏ hơn > 0,6. Dòng ngày giờ tô đen.
- **Luật đếm** (`src/counting.py`): cắt vòng như cũ; thêm ngoại suy cho vết nhanh (≥ 60 px/frame; chim lượn 20–35, chim qua lỗ 150–200): vết mất ngay ngoài vòng mà đi tiếp ≤ 2 frame thì vào vòng → RA; vết mới mà lùi lại ≤ 2 frame thì ra từ vòng → VỀ. Vết sinh và mất đều trong vòng → không rõ chiều, chỉ đếm riêng. Vết mất ở mép khung không tính.
- **Model COCO không dùng được để thử:** `yolo26n` COCO không ra class bird lần nào trên ảnh IR ngày 22/10, kể cả ngưỡng 0,02 (nó gọi hộp gỗ là lò vi sóng/TV). Phải có model tự train (GĐ2). Trong lúc chờ, `tools/track_clip.py --detector motion` lấy vật chuyển động làm phát hiện để xem tracker và bộ đếm: đoạn 05:22 (20 giây) có tới 9 vết cùng lúc, ô xanh bám đúng các con lượn phía trái hộp, kể cả vệt chim sát ống kính; xử lý ~49 FPS trên laptop. Model COCO 2 ô chạy ~7 FPS trên laptop (chỉ tham khảo, cổng 1 đo trên máy chạy thật).

**Còn lại sau 22/10:**

- [ ] Giảm thời gian phơi sáng của camera, quay clip, đo lại cỡ và tốc độ chim qua lỗ
- [ ] Gán vài chục vệt qua lỗ làm dữ liệu thử: YOLO có phát hiện được vệt mờ 1 khung không
- [ ] Xem clip phiên chiều 22/10
