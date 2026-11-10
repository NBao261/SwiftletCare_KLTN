/**
 * AlertQueue – cảnh báo chờ broker xác nhận (Report 4 §7.2, NFR-06 c)
 *
 * C++ thuần (không include Arduino) để chạy unit test trên host: pio test -e native
 *
 * Cảnh báo nằm trong hàng đợi cho tới khi có PUBACK, MQTTManager lưu cả khối vào NVS sau mỗi lần đổi nên
 * mất điện lúc mất mạng cũng không mất. Backend bỏ bản trùng theo `eventId`, nên gửi lại là an toàn.
 * Cùng loại cảnh báo đang chờ thì không thêm bản mới: sự cố đang diễn ra chỉ cần báo 1 lần.
 */
#pragma once
#include <stdint.h>

constexpr uint8_t ALERT_QUEUE_SIZE = 8;

struct QueuedAlert {
  char eventId[17] = "";
  char type[24] = "";
  char severity[10] = "";
  char message[160] = "";
  char resetReason[16] = "";
};

class AlertQueue {
public:
  /** false khi đầy: caller thử lại sau. Cùng loại đang chờ thì coi như đã nhận */
  bool push(const QueuedAlert &alert);
  /** Vị trí cảnh báo đầu tiên chưa gửi trong phiên này, -1 nếu hết */
  int nextUnsent() const;
  const QueuedAlert &at(int index) const { return entries[index].alert; }
  void markSent(int index, int msgId);
  /** PUBACK của `msgId`: bỏ cảnh báo tương ứng. false nếu msgId không phải của hàng đợi */
  bool ack(int msgId);
  /** Mất kết nối: msgId cũ hết nghĩa, gửi lại mọi cảnh báo còn trong hàng đợi */
  void resetSent();
  uint8_t size() const { return count; }

private:
  struct Entry {
    QueuedAlert alert;
    int msgId = 0; // 0: chưa gửi trong phiên này
  };
  Entry entries[ALERT_QUEUE_SIZE];
  uint8_t count = 0;
};
