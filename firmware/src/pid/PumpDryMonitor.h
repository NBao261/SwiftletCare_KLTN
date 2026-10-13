/**
 * PumpDryMonitor – phát hiện bơm phun sương chạy khô và chốt ngừng phun (THREAT-FR-011)
 *
 * C++ thuần (không include Arduino) để chạy unit test trên host: pio test -e native
 *
 * Logic mờ bật/tắt bơm theo chu kỳ nên không có "BẬT liên tục 5 phút": 1 ĐỢT PHUN
 * = liên tục có nhu cầu phun; trong đợt cộng dồn thời gian relay thực sự BẬT. Cứ
 * mỗi `onMs` BẬT cộng dồn thì so độ ẩm với đầu khối đó: không tăng quá `minRise`
 * điểm %RH → bơm khô. Báo và CHỐT (blocked) để bảo vệ bơm.
 *
 * Chốt nhả khi:
 * - nhu cầu phun về 0 (hết đợt), hoặc
 * - chuyển giữa tự động và can thiệp tay (người dùng bật tay sau khi châm nước), hoặc
 * - đã chốt đủ `retryMs`: tự thử phun lại. Bơm khô thì độ ẩm không tự lên nên nhu cầu
 *   không tự về 0 — không có đường thử lại này thì MỘT lần báo nhầm (bơm còn nước
 *   nhưng độ ẩm đang cân bằng, quạt hút ẩm ra…) sẽ tắt phun sương vô thời hạn. Thử
 *   lại mà vẫn khô thì báo và chốt lại sau `onMs` BẬT nữa.
 *
 * Mất số đo độ ẩm (`sensorOk = false`) KHÔNG phải là hết nhu cầu: giữ nguyên mọi
 * trạng thái, không cộng dồn. Nếu coi là hết đợt thì RS485 chập chờn sẽ xoá phần
 * đã cộng dồn mỗi lần đọc lỗi và không bao giờ phát hiện được bơm khô.
 */
#pragma once
#include <stdint.h>

class PumpDryMonitor {
public:
  /**
   * Gọi 1 lần mỗi chu kỳ điều khiển.
   * @param sensorOk có số đo độ ẩm hợp lệ ở chu kỳ này; false thì `demand`/`humidity` bị bỏ qua
   * @param demand   đang có nhu cầu phun (tự động: bộ mờ > 0%; can thiệp tay: relay được ép BẬT)
   * @param manual   relay phun đang bị can thiệp tay
   * @param relayOn  relay phun thực sự BẬT trong chu kỳ vừa qua
   * @param humidity %RH đo thô
   * @param retryMs  chốt bao lâu thì tự thử phun lại
   * @return true đúng 1 lần mỗi lần phát hiện bơm khô
   */
  bool update(bool sensorOk, bool demand, bool manual, bool relayOn, float humidity, uint32_t nowMs,
              uint32_t onMs, float minRise, uint32_t retryMs);
  /** Đang chốt ngừng phun (chỉ áp cho chế độ tự động — can thiệp tay vẫn bật được bơm). */
  bool blocked() const { return _blocked; }

private:
  void startBlock(float humidity);

  bool _active = false;
  bool _blocked = false;
  bool _manual = false;
  bool _wasOn = false;
  uint32_t _onMs = 0;
  uint32_t _lastMs = 0;
  uint32_t _blockedSinceMs = 0;
  float _blockStartHumidity = 0;
};
