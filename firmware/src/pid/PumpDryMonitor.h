/**
 * PumpDryMonitor – phát hiện bơm phun sương chạy khô và chốt ngừng phun (THREAT-FR-011)
 *
 * C++ thuần (không include Arduino) để chạy unit test trên host: pio test -e native
 *
 * Logic mờ bật/tắt bơm theo chu kỳ nên không có "BẬT liên tục 5 phút": 1 ĐỢT PHUN
 * = liên tục có nhu cầu phun; trong đợt cộng dồn thời gian relay thực sự BẬT. Cứ
 * mỗi `onMs` BẬT cộng dồn thì so độ ẩm với đầu khối đó: không tăng quá `minRise`
 * điểm %RH → bơm khô. Báo 1 lần/đợt và CHỐT (blocked) tới hết đợt để bảo vệ bơm.
 *
 * Hết đợt = nhu cầu phun về 0, hoặc chuyển giữa tự động và can thiệp tay. Vế sau
 * là đường thử lại sau khi châm nước: bơm khô thì độ ẩm không tự lên nên nhu cầu
 * tự động không tự về 0 — người dùng bật tay một lần, hết override thì đợt mới
 * bắt đầu và hệ thống thử phun lại.
 */
#pragma once
#include <stdint.h>

class PumpDryMonitor {
public:
  /**
   * Gọi 1 lần mỗi chu kỳ điều khiển.
   * @param demand   đang có nhu cầu phun (tự động: bộ mờ > 0%; can thiệp tay: relay được ép BẬT)
   * @param manual   relay phun đang bị can thiệp tay
   * @param relayOn  relay phun thực sự BẬT trong chu kỳ vừa qua
   * @param humidity %RH đo thô; NAN (cảm biến lỗi) thì chu kỳ này không đánh giá
   * @return true đúng 1 lần khi phát hiện bơm khô trong đợt
   */
  bool update(bool demand, bool manual, bool relayOn, float humidity, uint32_t nowMs, uint32_t onMs,
              float minRise);
  /** Đang chốt ngừng phun (chỉ áp cho chế độ tự động — can thiệp tay vẫn bật được bơm). */
  bool blocked() const { return _blocked; }

private:
  bool _active = false;
  bool _blocked = false;
  bool _manual = false;
  bool _wasOn = false;
  uint32_t _onMs = 0;
  uint32_t _lastMs = 0;
  float _blockStartHumidity = 0;
};
