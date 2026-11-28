# Kế hoạch: thông báo lỗi dễ nhìn cho mọi role (web, 28/11/2026)

Nguồn: rà soát toàn bộ cách `frontend/` báo lỗi cho Farm Owner, Farm Technician, Domain Expert, Administrator và các trang đăng nhập. Kế hoạch này là danh sách việc, không phải yêu cầu. Quy tắc nền là `frontend/FE_Design_Claude.md` §13.5 và §13.16 b: lỗi API gộp theo nhóm, không hiện mã HTTP, mã lỗi hay câu nguyên văn của backend.

Phạm vi: `frontend/` (mọi role). Ngoài phạm vi: `mobile/` (Len), câu chữ do backend sinh (alert, Work Order, Telegram, e-mail).

## 1. Hiện trạng (đã đếm trong code)

| # | Vấn đề | Chỗ thấy | Hậu quả với người dùng |
|---|---|---|---|
| 1 | **Lỗi 429 (thao tác quá nhanh) hiện thành "Không kết nối được máy chủ"**; test hiện tại còn khẳng định đúng điều đó | `lib/apiError.ts`, `error.i18n.ts` | Người dùng đi kiểm mạng trong khi máy chủ vẫn sống và chỉ cần đợi vài giây |
| 2 | **Sai mật khẩu hiện "phiên đăng nhập đã hết hạn"**: 401 gộp vào nhóm quyền. Trang đăng nhập né bằng cách hiện nguyên văn câu backend | `LoginPage.tsx` | Hoặc câu sai nghĩa, hoặc vi phạm §13.16 b |
| 3 | **16 chỗ vẫn hiện nguyên văn câu backend** (`getApiErrorMessage`): khoá/mở khoá tài khoản, ngưỡng mặc định, yêu cầu xoá, lời mời, đặt lại mật khẩu, khởi động lại thiết bị, tạo Zone, nhật ký, sức khỏe hệ thống | `grep getApiErrorMessage` | Câu tiếng Anh hoặc kỹ thuật như "Invalid value", không dịch được sang EN |
| 4 | **Lỗi 5xx, lỗi mạng, hết phiên dùng chung một câu** "Không kết nối được máy chủ. Thử lại sau." | `error.i18n.ts` | Không phân biệt máy chủ lỗi với mất mạng; 409 (trùng, đã đổi) và 413/415 (file) cũng chỉ là "chưa hợp lệ" |
| 5 | **Thất bại trong im lặng**: `ExpertVerdictDrawer` gọi `mutateAsync` không bắt lỗi, nên lưu kiểm chứng lỗi thì không có gì hiện ra | `ExpertVerdictDrawer.tsx` | Chuyên gia tưởng đã lưu |
| 6 | **6 trang tải dữ liệu mà không có trạng thái lỗi**: danh sách trống giống hệt danh sách tải lỗi | `AdminUsersPage`, `AdminAccountRequestsPage`, `DomainExpertHistoryPage`, `DomainExpertAlertVerdictsPage`, `DomainExpertReportsPage`, `DomainExpertZoneTuningPage` | Mất kết nối thì thấy "chưa có dữ liệu" |
| 7 | **Toast lỗi chỉ ở 4 giây**, như toast thành công, không có biểu tượng, không `aria-live`; không bấm nút đóng nào thấy được; câu dài tràn khỏi màn hình điện thoại. Trang Kiểm chứng của chuyên gia còn có một toast riêng thứ hai | `components/common/Toast.tsx`, `toastStore.ts` | Đọc chưa kịp đã mất; trình đọc màn hình không báo |
| 8 | **Lỗi dưới ô nhập chỉ là chữ đỏ 12px**: không biểu tượng, không `aria-invalid`, không `aria-describedby`; `Select`, `DatePicker`, `TimePicker` mỗi nơi một kiểu | `components/ui/Input.tsx` và 4 file kề | Người mù màu không thấy; trình đọc màn hình không biết ô nào lỗi |
| 9 | **Khối lỗi trong form có ít nhất 8 kiểu khác nhau**: khung nền đỏ nhạt có/không `role="alert"`, chữ đỏ trần cỡ `xs` hoặc `sm`, khung viền | ~25 chỗ, xem mục 4.3 | Cùng một loại lỗi nhìn mỗi màn mỗi khác |
| 10 | **Trạng thái lỗi tải dữ liệu mỗi nơi một chữ**: "Thử lại" có 4 khoá dịch (`page.retry`, `common.retry`, `error.retry`, chữ trần); 43 file dựng `EmptyState` + nút thủ công; nhiều nơi không nói nguyên nhân | 43 file | Không nhất quán; người dùng không biết nên đợi hay kiểm mạng |
| 11 | **Không có `ErrorBoundary`** dù FE_Design §13.5 bắt buộc: một component lỗi khi render làm trắng cả app | `AppShell.tsx` | Màn trắng, không đường ra |
| 12 | Lỗi thiếu ngữ cảnh: nhiều toast chỉ có câu nhóm, không nói thao tác nào vừa thất bại | `DomainExpertZoneTuningPage` (`apiErrorMessage(error)`) | "Thông tin chưa hợp lệ" mà không biết là lưu ngưỡng hay hệ số |

## 2. Nguyên tắc

1. **Mỗi lỗi nói ba điều**: thao tác nào thất bại, vì sao ở mức người dùng hiểu được, làm gì tiếp ("Thử lại", "Đợi 20 giây", "Đăng nhập lại", "Kiểm tra ô đã tô đỏ"). Không mã HTTP, không mã lỗi, không câu của backend (§13.16 b).
2. **Một chỗ định nghĩa câu chữ**: `error.i18n.ts` giữ câu của từng nhóm lỗi và câu theo mã lỗi đã biết, đủ VI và EN. Màn không tự viết lại câu chung.
3. **Một kiểu hiện cho mỗi tình huống**:
   - lỗi một ô → `FieldError` dưới ô;
   - lỗi khi gửi form → `ErrorNotice` ngay trên nút gửi (không để toast, vì form còn mở);
   - thao tác ngoài form (nút trong bảng, công tắc) → toast lỗi;
   - tải dữ liệu thất bại → `LoadError` có nút Thử lại;
   - render hỏng → `ErrorBoundary`.
4. **Không chỉ dựa vào màu**: mọi lỗi có biểu tượng cảnh báo và chữ. Chữ lỗi tối thiểu 13px (`text-small`), tương phản đạt 4,5:1.
5. **Trình đọc màn hình**: `role="alert"` cho lỗi mới xuất hiện, `aria-invalid` và `aria-describedby` cho ô lỗi, vùng toast `aria-live`.

## 3. Thiết kế

### 3.1 Phân nhóm lỗi (`lib/apiError.ts`)

| Nhóm | Điều kiện | Câu (VI) |
|---|---|---|
| `network` | không có phản hồi | Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại. |
| `server` | 500, 502, 503, 504 | Máy chủ đang gặp sự cố. Thử lại sau ít phút. |
| `rateLimited` | 429 | Bạn thao tác quá nhanh. Thử lại sau {n} giây. (`{n}` lấy từ `error.details.retryAfterSec`; thiếu thì "Thử lại sau ít phút.") |
| `session` | 401 | Phiên đăng nhập đã hết hạn. Đăng nhập lại để tiếp tục. |
| `forbidden` | 403 | Bạn không có quyền thực hiện thao tác này. |
| `notFound` | 404, 410 | Không tìm thấy dữ liệu hoặc dữ liệu đã bị xoá. |
| `conflict` | 409 | Dữ liệu vừa được thay đổi hoặc đã tồn tại. Tải lại rồi thử lại. |
| `upload` | 413, 415 | File quá lớn hoặc không đúng định dạng. |
| `invalid` | 400, 422, còn lại 4xx | Thông tin chưa hợp lệ. Kiểm tra các ô đã báo lỗi rồi thử lại. |

Thêm `getApiErrorCode(error)` và `getRetryAfterSec(error)`.

### 3.2 Câu theo mã lỗi đã biết (`errorCodeDict`)

Chỉ những mã mà màn cần nói đúng lý do, do client viết (không lấy câu backend): `ACCOUNT_DISABLED`, `RATE_LIMITED`, `INVALID_CURRENT_PASSWORD`, `PASSWORD_UNCHANGED`, `INVALID_RESET_TOKEN`, `HAS_ACTIVE_DEVICES`, `DUPLICATE_NAME`, `RATING_CLOSED`, `INVALID_UPLOAD`, `SERVICE_UNAVAILABLE`. Các mã thiết lập thiết bị (`INVALID_DEVICE_LABEL`, `DEVICE_REVOKED`, …) đã có bảng riêng ở `registrationFailure.ts`, giữ nguyên.

### 3.3 Hook `useApiErrorMessage`

`apiErrorMessage(error, context?, overrides?)`. Thứ tự chọn câu: `overrides[mã lỗi]` → `overrides[mã HTTP]` → `errorCodeDict[mã lỗi]` → câu nhóm. `overrides` cho phép màn đổi nghĩa của một mã: trang đăng nhập đặt `{ 401: 'Sai email hoặc mật khẩu' }`. Kết quả vẫn là `"{context}. {câu}"` như hiện nay, nên 76 chỗ gọi cũ không phải sửa.

### 3.4 Thành phần giao diện

| Thành phần | Việc |
|---|---|
| `ui/FieldError.tsx` (mới) | Biểu tượng + chữ `text-small`, có `id` để `aria-describedby` trỏ tới |
| `ui/Input`, `Textarea`, `Select`, `DatePicker`, `TimePicker` | Dùng `FieldError`; ô lỗi có `aria-invalid` và `aria-describedby` |
| `ui/ErrorNotice.tsx` (mới) | Khung nền đỏ nhạt, biểu tượng, `role="alert"`, tuỳ chọn nút Thử lại; thay mọi khối lỗi trong form |
| `ui/LoadError.tsx` (mới) | Thay `EmptyState` + nút thủ công khi tải thất bại: tiêu đề (tên thứ không tải được), câu của nhóm lỗi, nút "Thử lại" một chữ duy nhất |
| `ui/ErrorBoundary.tsx` (mới) | Bọc `<Outlet />` trong `AppShell` (đặt `key = pathname`), có nút Thử lại và Về trang chủ; không hiện `error.message` |
| `common/Toast.tsx`, `toastStore.ts` | Biểu tượng; toast lỗi 8 giây, thành công 4 giây; nút đóng nhìn thấy được; tối đa `max-w-sm` và canh giữa phía dưới trên điện thoại; `aria-live`; gộp toast trùng câu trong 1 giây |
| `DomainExpertAlertVerdictsPage` | Bỏ toast riêng, dùng toast chung |

## 4. Việc theo bước

### 4.1 Nền (`lib/`, `constants/`, `hooks/`, `components/ui/`)
`apiError.ts` (+ test), `error.i18n.ts`, `useApiErrorMessage.ts`, `FieldError`, `ErrorNotice`, `LoadError`, `ErrorBoundary`, `Toast`, `toastStore`, năm component có `error`, `en.ts` nếu thiếu câu.

### 4.2 Bỏ câu nguyên văn của backend (16 chỗ)
Đăng nhập (`overrides` 401, câu khoá tài khoản kèm lý do Admin nhập vì đó là dữ liệu của người dùng), lời mời, đặt lại mật khẩu, yêu cầu xoá tài khoản, khoá/mở khoá, ngưỡng mặc định (2 chỗ + thẻ), Thêm Zone, yêu cầu xoá của Admin, nhật ký, sức khỏe hệ thống, khởi động lại thiết bị. Sau đó xoá `getApiErrorMessage`.

### 4.3 Đưa khối lỗi inline về `ErrorNotice` / `FieldError`
Form có khối lỗi tự dựng: `CreateFarmOwnerModal`, `ChangePasswordPage`, `ForgotPasswordPage` (2), `LoginPage`, `InvitationPage`, `HealthReportCreateModal`, `CycleConclusionDrawer`, `ProfileFormDrawer`, `CoefficientProposalCard`, `CountingRingEditor`, `DomainExpertCountingRingPage`, `DomainExpertProfilesPage`, `DomainExpertWeatherRulesPage` (2), `StructureEditModal`, `HealthLevelsModal`. Lỗi từng ô tự dựng: `ThresholdColumn`, `WeatherRuleAddForm`, `LullabyTracksModal`, `MoveControllerModal`, `SpeakerScheduleModal`, `FarmFormModal`, `HarvestFormModal`, `HarvestPhotoField`, `ImageLinksField`, `MaintenancePlanFormModal`, `OnsiteCheckModal`, `WorkOrderCreateModal`, `WorkOrderDoneModal`, `Step2Validate`.

### 4.4 Chỗ im lặng và thiếu trạng thái lỗi
- `ExpertVerdictDrawer`: bắt lỗi, hiện `ErrorNotice` trong drawer, drawer không đóng.
- `DomainExpertZoneTuningPage`: mỗi `notify` truyền ngữ cảnh ("Lưu ngưỡng thất bại").
- Sáu trang ở mục 1.6: thêm `LoadError`.

### 4.5 Trạng thái lỗi tải dữ liệu
Đổi 43 file dựng `EmptyState` + nút Thử lại thủ công sang `LoadError` (một khoá dịch, có câu nguyên nhân). Chỗ có đoạn riêng (VD `RolloutDetail`) giữ nguyên.

## 5. Kiểm thử
- Vitest (không có môi trường DOM nên chỉ test logic thuần): `apiError.test.ts` đủ 9 nhóm, mã 429 có `retryAfterSec`, thiếu `details`; `getApiErrorCode`; hàm chọn câu theo thứ tự `overrides` → mã → nhóm (tách thành hàm thuần `resolveApiErrorSentence`); `errorDict` và `errorCodeDict` đủ khoá VI/EN (kiểu `Dictionary` đã bắt lỗi biên dịch).
- `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npx vitest run --no-file-parallelism`.
- Không chạy Playwright và không chụp màn hình: cần backend và dữ liệu seed.

## 6. Kết quả (28/11/2026)

- **Nền (4.1):** có `lib/apiError.ts` (9 nhóm, `getApiErrorCode`, `getRetryAfterSec`, `getApiErrorReason`), `lib/apiErrorMessage.ts` (hàm thuần `resolveApiErrorSentence`), `error.i18n.ts` (câu nhóm và 9 mã lỗi, VI và EN), `useApiErrorMessage(error, context?, overrides?)`, `FieldError`, `ErrorNotice`, `LoadError`, `ErrorBoundary` (bọc `<Outlet />`), toast mới (biểu tượng, lỗi 8 giây, nút đóng, `aria-live`, gộp câu trùng). `Input`, `Textarea`, `Select`, `DatePicker`, `TimePicker` dùng `FieldError` và có `aria-invalid`, `aria-describedby`.
- **Câu nguyên văn của backend (4.2):** hết cả 16 chỗ; `getApiErrorMessage` không còn được gọi (hàm vẫn nằm trong `lib/helpers.ts`, xoá ở bước sau). Đăng nhập: 401 là "Sai email hoặc mật khẩu", tài khoản khoá hiện lý do Administrator đã ghi.
- **Im lặng và thiếu trạng thái lỗi (4.4):** `ExpertVerdictDrawer` bắt lỗi và hiện `ErrorNotice`; `DomainExpertZoneTuningPage` nói thao tác nào thất bại và có `LoadError`; thêm `LoadError` cho Người dùng, Yêu cầu xoá tài khoản, Lịch sử quyết định, Kiểm chứng cảnh báo. Hộp Cài đặt gửi mã đặt lại cũng báo lỗi. `DomainExpertReportsPage` và `FarmOwnerDeviceSetupPage` không đổi: trang đầu giao cho các khối con đã có trạng thái lỗi, trang sau là wizard không tải dữ liệu.
- **Khối lỗi inline (4.3):** 12 form dùng `ErrorNotice`; 24 chỗ lỗi từng ô dùng `FieldError`.
- **Lỗi tải dữ liệu (4.5):** 27 khối `EmptyState` + nút Thử lại đổi sang `LoadError`. Còn 6 khối giữ nguyên vì đã có câu nguyên nhân riêng: `FarmOwnerAnalyticsPage`, `FarmOwnerDashboardPage`, `FarmOwnerDeviceDetailPage`, `FarmOwnerDevicesPage`, `FarmOwnerVisionPage`, `TechnicianDevicesPage`.
- **Kiểm tra:** `npm run lint`, `npx tsc --noEmit`, `npm run build` và `npx vitest run --no-file-parallelism` qua. Đã mở trang đăng nhập bằng trình duyệt và xem khối lỗi mới. Các màn khác chưa xem bằng mắt.

## 7. Không làm
- Không hiện câu của backend cho 400 và 409 dù nhiều câu rất cụ thể (VD "Nhà còn khu vực ở tầng 3"): FE_Design §13.16 b cấm; muốn bật thì phải để backend gắn mã lỗi riêng cho từng câu rồi thêm vào `errorCodeDict`.
- Banner mất mạng toàn app (`navigator.onLine`): việc riêng.
- `mobile/`.

## 8. Thứ tự
4.1 → 4.2 → 4.4 → 4.3 → 4.5, test và build sau mỗi bước. Một PR, các commit theo bước.
