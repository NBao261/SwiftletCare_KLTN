#!/usr/bin/env python3
"""Ghi device ID và mật khẩu broker vào NVS của ESP32 (FARM-FR-010, Report 4 D3).

Chạy 1 lần lúc xuất xưởng, SAU KHI nạp firmware. Lệnh này ghi đè toàn bộ phân vùng NVS (Wi-Fi, ngưỡng đã lưu).

    pip install esp-idf-nvs-partition-gen esptool
    python tools/flash_identity.py --port COM5 --device-id node_001 --broker-secret <broker_secret> [--broker mqtt.swiftletcare.vn]

`broker_secret` lấy từ màn kho thiết bị khi nhập thiết bị, hoặc `npm run device:broker-secret -- <deviceId>`
trong backend/. Mật khẩu chỉ nằm trong file tạm và bị xoá ngay sau khi ghi.
"""
import argparse
import subprocess
import sys
import tempfile
from pathlib import Path

# firmware/platformio.ini dùng min_spiffs.csv
NVS_OFFSET = "0x9000"
NVS_SIZE = "0x5000"


def run(*args: str) -> None:
    subprocess.run([sys.executable, "-m", *args], check=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--port", required=True)
    parser.add_argument("--device-id", required=True)
    parser.add_argument("--broker-secret", required=True)
    # FARM-FR-003c: địa chỉ broker đặt lúc flash (trang AP-mode bản chính thức chỉ nhập Wi-Fi);
    # bỏ trống thì thiết bị dùng địa chỉ biên dịch trong Secrets.h
    parser.add_argument("--broker", help="Tên miền hoặc IP của broker, vd mqtt.swiftletcare.vn")
    args = parser.parse_args()

    with tempfile.TemporaryDirectory() as folder:
        csv_path = Path(folder) / "identity.csv"
        bin_path = Path(folder) / "identity.bin"
        csv_path.write_text(
            "key,type,encoding,value\n"
            "identity,namespace,,\n"
            f"device_id,data,string,{args.device_id}\n"
            f"broker_secret,data,string,{args.broker_secret}\n"
            # StorageManager đọc broker ở namespace `swiftlet`, khoá `mqttBroker`
            + (f"swiftlet,namespace,,\nmqttBroker,data,string,{args.broker}\n" if args.broker else ""),
            encoding="utf-8",
        )
        run("esp_idf_nvs_partition_gen", "generate", str(csv_path), str(bin_path), NVS_SIZE)
        run("esptool", "--port", args.port, "write_flash", NVS_OFFSET, str(bin_path))
    print(f"Đã ghi tài khoản của {args.device_id}. Khởi động lại thiết bị rồi cài Wi-Fi qua AP-mode.")


if __name__ == "__main__":
    main()
