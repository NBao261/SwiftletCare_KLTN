import base64
import io
import json
import sys
import urllib.error
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))

import camera_source  # noqa: E402
from camera_source import CameraSource, classify_ffprobe, fetch_source, parse_source_version  # noqa: E402
from setup_node import env_values, merge_env  # noqa: E402
from stream import apply_env_overrides  # noqa: E402


def test_source_version_only_from_this_device_and_valid_numbers():
    assert parse_source_version({"deviceId": "cam-1", "camera_source_version": 3}, "cam-1") == 3
    assert parse_source_version({"camera_source_version": 0}, "cam-1") == 0
    assert parse_source_version({"deviceId": "cam-2", "camera_source_version": 3}, "cam-1") is None
    for bad in (-1, "3", True, None):
        assert parse_source_version({"deviceId": "cam-1", "camera_source_version": bad}, "cam-1") is None
    assert parse_source_version([], "cam-1") is None


def test_ffprobe_answer_tells_wrong_password_from_unreachable_camera():
    assert classify_ffprobe(1, "[rtsp @ 0x1] method DESCRIBE failed: 401 Unauthorized") == "AUTH_FAILED"
    assert classify_ffprobe(1, "rtsp://cam:554/x: Server returned 401 Unauthorized (authorization failed)") == "AUTH_FAILED"
    # "401" trong đường dẫn hay cổng không phải sai mật khẩu
    assert classify_ffprobe(1, "rtsp://cam:8401/Streaming/Channels/401: Connection refused") == "UNREACHABLE"
    assert classify_ffprobe(1, "Connection to tcp://203.0.113.7:554 failed: Connection refused") == "UNREACHABLE"
    assert classify_ffprobe(1, "Connection timed out") == "UNREACHABLE"
    assert classify_ffprobe(0, "") == "NO_FRAMES"


def test_new_version_in_config_asks_for_the_address_again_only_when_managed():
    managed = CameraSource(api_base="https://x/api", device_id="cam-1", secret="s")
    managed._version = 2
    managed.on_message(json.dumps({"deviceId": "cam-1", "camera_source_version": 2}).encode())
    assert not managed._refresh.is_set()
    managed.on_message(json.dumps({"deviceId": "cam-1", "camera_source_version": 3}).encode())
    assert managed._refresh.is_set()
    managed.on_message(b"not json")             # tin hỏng không làm gì

    fixed = CameraSource(fixed_url="rtsp://cam/stream1")
    fixed.on_message(json.dumps({"deviceId": "cam-1", "camera_source_version": 9}).encode())
    assert not fixed._refresh.is_set()
    assert fixed.url() == "rtsp://cam/stream1"


def test_fetch_source_sends_the_device_login_and_treats_404_as_no_address(monkeypatch):
    seen = {}

    class Response(io.BytesIO):
        def __enter__(self): return self
        def __exit__(self, *exc): return False

    def fake_urlopen(request, timeout):
        seen["auth"] = request.headers["Authorization"]
        seen["url"] = request.full_url
        return Response(json.dumps({"success": True, "data": {"version": 4, "rtsp_url": "rtsp://a:b@h:554/s"}}).encode())

    monkeypatch.setattr(camera_source.urllib.request, "urlopen", fake_urlopen)
    assert fetch_source("https://x/api/", "cam-1", "secret") == (4, "rtsp://a:b@h:554/s")
    assert seen["url"] == "https://x/api/agent/camera-source"
    assert base64.b64decode(seen["auth"].split(" ")[1]).decode() == "cam-1:secret"

    def not_attached(request, timeout):
        raise urllib.error.HTTPError(request.full_url, 404, "Not Found", {}, None)

    monkeypatch.setattr(camera_source.urllib.request, "urlopen", not_attached)
    assert fetch_source("https://x/api", "cam-1", "secret") == (0, None)


def test_setup_writes_identity_into_env_and_keeps_other_lines():
    identity = {
        "device_id": "cam-h1-01", "broker_secret": "s3cret",
        "broker": {"host": "sc.example.vn", "port": 8883, "tls": True},
        "stream_publish_url": "rtsps://cam-h1-01:s3cret@sc.example.vn:8322/cam-cam-h1-01",
    }
    values = env_values("https://sc.example.vn/api/", identity)
    old = "# ghi chú\nCAMERA_DEVICE_ID=cũ\nCAMERA_RTSP_URL=\nMQTT_PASSWORD=old\n"
    merged = merge_env(old, values)
    assert merged.startswith("# ghi chú\nCAMERA_DEVICE_ID=cam-h1-01\nCAMERA_RTSP_URL=\nMQTT_PASSWORD=s3cret\n")
    for line in ("API_BASE_URL=https://sc.example.vn/api", "MQTT_BROKER=sc.example.vn", "MQTT_PORT=8883", "MQTT_TLS=true",
                 "STREAM_PUSH_URL=rtsps://cam-h1-01:s3cret@sc.example.vn:8322/cam-cam-h1-01"):
        assert line in merged.splitlines()
    # Máy dev: backend không có địa chỉ broker → không ghi, giữ config.yaml
    dev = env_values("http://localhost:3000", {"device_id": "cam-1", "broker_secret": "x", "broker": None, "stream_publish_url": None})
    assert set(dev) == {"API_BASE_URL", "CAMERA_DEVICE_ID", "MQTT_PASSWORD"}


def test_broker_from_env_wins_over_config_yaml():
    cfg = {"mqtt": {"broker": "localhost", "port": 1883, "tls": False}}
    apply_env_overrides(cfg, {"MQTT_BROKER": "sc.example.vn", "MQTT_PORT": "8883", "MQTT_TLS": "true"})
    assert cfg["mqtt"] == {"broker": "sc.example.vn", "port": 8883, "tls": True}
    assert apply_env_overrides({"mqtt": {"broker": "a", "port": 1, "tls": False}}, {})["mqtt"]["broker"] == "a"
