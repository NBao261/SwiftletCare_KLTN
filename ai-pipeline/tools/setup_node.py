"""Cài đặt nút AI bằng mã cài đặt (FARM-FR-010): không chép mật khẩu broker bằng tay.

    python tools/setup_node.py --server https://<tên miền>/api

Administrator tạo mã ở màn Kho thiết bị ("Mã cài đặt nút AI", dùng một lần, 30 phút). Công cụ đổi mã lấy mã thiết bị,
mật khẩu broker, địa chỉ broker và địa chỉ đẩy hình, ghi vào .env (giữ các dòng khác), rồi thử đăng nhập broker.
Địa chỉ camera không nằm ở đây: Farm Owner nhập trên web, nút AI tự lấy khi chạy.
"""
import argparse
import json
import sys
import threading
import urllib.error
import urllib.request
from pathlib import Path
from typing import Dict, Optional

ENV_FILE = Path(__file__).resolve().parents[1] / ".env"
BROKER_CHECK_SEC = 15


def env_values(server: str, identity: dict) -> Dict[str, str]:
    """Các dòng .env từ câu trả lời của /agent/enroll."""
    values = {
        "API_BASE_URL": server.rstrip("/"),
        "CAMERA_DEVICE_ID": identity["device_id"],
        "MQTT_PASSWORD": identity["broker_secret"],
    }
    broker = identity.get("broker")
    if broker:
        values.update(MQTT_BROKER=broker["host"], MQTT_PORT=str(broker["port"]), MQTT_TLS="true" if broker["tls"] else "false")
    if identity.get("stream_publish_url"):
        values["STREAM_PUSH_URL"] = identity["stream_publish_url"]
    return values


def merge_env(text: str, values: Dict[str, str]) -> str:
    """Thay giá trị các khoá đã có, thêm khoá chưa có ở cuối; giữ nguyên chú thích và các dòng khác."""
    lines, seen = [], set()
    for line in text.splitlines():
        key = line.split("=", 1)[0].strip()
        if "=" in line and not line.lstrip().startswith("#") and key in values:
            lines.append(f"{key}={values[key]}")
            seen.add(key)
        else:
            lines.append(line)
    lines += [f"{key}={value}" for key, value in values.items() if key not in seen]
    return "\n".join(lines) + "\n"


def enroll(server: str, setup_code: str) -> dict:
    request = urllib.request.Request(f"{server.rstrip('/')}/agent/enroll", data=json.dumps({"setup_code": setup_code}).encode(),
                                     headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return json.load(response)["data"]
    except urllib.error.HTTPError as err:
        try:
            message = json.load(err)["error"]["message"]
        except (ValueError, KeyError):
            message = f"HTTP {err.code}"
        raise SystemExit(f"Không cài đặt được: {message}") from None
    except urllib.error.URLError as err:
        raise SystemExit(f"Không kết nối được máy chủ {server}: {err.reason}") from None


def check_broker(values: Dict[str, str]) -> Optional[str]:
    """None khi đăng nhập broker được; còn lại là lý do."""
    if "MQTT_BROKER" not in values:
        return None   # máy dev: broker trong config.yaml, kiểm khi chạy stream.py
    import paho.mqtt.client as mqtt

    result: Dict[str, object] = {}
    done = threading.Event()

    def on_connect(_client, _userdata, _flags, reason, _props) -> None:
        result["reason"] = reason
        done.set()

    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=f"SC-{values['CAMERA_DEVICE_ID']}-setup")
    client.username_pw_set(values["CAMERA_DEVICE_ID"], values["MQTT_PASSWORD"])
    if values.get("MQTT_TLS") == "true":
        client.tls_set()
    client.on_connect = on_connect
    try:
        client.connect(values["MQTT_BROKER"], int(values["MQTT_PORT"]))
    except OSError as err:
        return f"không tới được {values['MQTT_BROKER']}:{values['MQTT_PORT']} ({err})"
    client.loop_start()
    connected = done.wait(BROKER_CHECK_SEC)
    client.disconnect()
    client.loop_stop()
    if not connected:
        return "broker không trả lời"
    reason = result["reason"]
    return None if not getattr(reason, "is_failure", False) else f"broker từ chối ({reason})"


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")   # console Windows mặc định không in được tiếng Việt
    ap = argparse.ArgumentParser(description="Cài đặt nút AI bằng mã cài đặt từ màn Kho thiết bị")
    ap.add_argument("--server", required=True, help="địa chỉ API, VD https://swiftletcare.example.vn/api")
    ap.add_argument("--code", help="mã cài đặt (không truyền thì hỏi)")
    args = ap.parse_args()

    code = args.code or input("Mã cài đặt (VD 7KQ2-M9XA): ").strip()
    identity = enroll(args.server, code)
    values = env_values(args.server, identity)
    old = ENV_FILE.read_text(encoding="utf-8") if ENV_FILE.exists() else ""
    ENV_FILE.write_text(merge_env(old, values), encoding="utf-8")
    try:
        ENV_FILE.chmod(0o600)   # chỉ chủ máy đọc được mật khẩu broker
    except OSError:
        pass
    print(f"Đã ghi {ENV_FILE} cho nút AI {values['CAMERA_DEVICE_ID']}.")

    problem = check_broker(values)
    if problem:
        raise SystemExit(f"Đã lưu danh tính nhưng chưa đăng nhập được broker: {problem}")
    print("Đăng nhập broker thành công." if "MQTT_BROKER" in values else "Máy dev: broker lấy theo config/config.yaml.")
    print("Tiếp theo: Farm Owner gắn camera vào nhà và nhập địa chỉ camera trên web, rồi chạy python src/stream.py")


if __name__ == "__main__":
    main()
