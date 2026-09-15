#include <Arduino.h>
#include <ModbusMaster.h>

#define RS485_TX_PIN 17
#define RS485_RX_PIN 16

ModbusMaster node;

void setup() {
  Serial.begin(115200);
  delay(2000);
  Serial.println("\n\n========================================");
  Serial.println("      MODBUS SCANNER (ESP32)");
  Serial.println("========================================");
  Serial.println("Tool quét tự động để tìm Slave ID và Baudrate thực sự của cảm biến.");
  Serial.println("Bắt đầu quét sau 3 giây...\n");
  delay(3000);
}

void loop() {
  // --- Quét Baudrate 4800 ---
  Serial.println("----------------------------------------");
  Serial.println(">>> ĐANG QUÉT Ở BAUDRATE: 4800");
  Serial2.begin(4800, SERIAL_8N1, RS485_RX_PIN, RS485_TX_PIN);
  delay(500);

  for (uint8_t id = 1; id < 255; id++) {
    node.begin(id, Serial2);
    uint8_t result = node.readHoldingRegisters(0x0000, 1);
    
    if (result == node.ku8MBSuccess) {
      Serial.println("\n🎉🎉🎉 BINGO! TÌM THẤY CẢM BIẾN 🎉🎉🎉");
      Serial.printf("   - Slave ID thực tế: %d\n", id);
      Serial.printf("   - Baudrate thực tế: 4800\n", id);
      Serial.printf("   - Giá trị thanh ghi 0x0000: %d\n\n", node.getResponseBuffer(0));
      delay(10000); // Dừng lại 10 giây để bạn đọc
    } else if (result != node.ku8MBResponseTimedOut) {
      // Có phản hồi nhưng báo lỗi khác (Illegal Data, v.v)
      // Điều này cũng chứng tỏ ĐÃ TÌM THẤY đúng ID và Baudrate
      Serial.println("\n⚠️ TÌM THẤY CẢM BIẾN NHƯNG THANH GHI 0x0000 BỊ LỖI!");
      Serial.printf("   - Slave ID thực tế: %d\n", id);
      Serial.printf("   - Baudrate thực tế: 4800\n", id);
      Serial.printf("   - Mã lỗi Modbus: 0x%02X\n\n", result);
      delay(10000);
    }
    
    if (id % 20 == 0) Serial.print("."); // In dấu chấm cho biết đang chạy
    delay(10);
  }
  Serial.println("\nHoàn tất quét 4800.");

  // --- Quét Baudrate 9600 ---
  Serial.println("----------------------------------------");
  Serial.println(">>> ĐANG QUÉT Ở BAUDRATE: 9600");
  Serial2.begin(9600, SERIAL_8N1, RS485_RX_PIN, RS485_TX_PIN);
  delay(500);

  for (uint8_t id = 1; id < 255; id++) {
    node.begin(id, Serial2);
    uint8_t result = node.readHoldingRegisters(0x0000, 1);
    
    if (result == node.ku8MBSuccess) {
      Serial.println("\n🎉🎉🎉 BINGO! TÌM THẤY CẢM BIẾN 🎉🎉🎉");
      Serial.printf("   - Slave ID thực tế: %d\n", id);
      Serial.printf("   - Baudrate thực tế: 9600\n", id);
      Serial.printf("   - Giá trị thanh ghi 0x0000: %d\n\n", node.getResponseBuffer(0));
      delay(10000);
    } else if (result != node.ku8MBResponseTimedOut) {
      Serial.println("\n⚠️ TÌM THẤY CẢM BIẾN NHƯNG THANH GHI 0x0000 BỊ LỖI!");
      Serial.printf("   - Slave ID thực tế: %d\n", id);
      Serial.printf("   - Baudrate thực tế: 9600\n", id);
      Serial.printf("   - Mã lỗi Modbus: 0x%02X\n\n", result);
      delay(10000);
    }
    
    if (id % 20 == 0) Serial.print(".");
    delay(10);
  }
  Serial.println("\nHoàn tất quét 9600.");
  
  Serial.println("Đang lặp lại vòng quét...");
  delay(2000);
}
