"""Camera address entered by the Farm Owner on the web: fetched from /agent/camera-source at start and whenever the
retained config carries a new camera_source_version. The URL holds the camera password: memory only, never logged."""
import base64
import json
import subprocess
import threading
import urllib.error
import urllib.request
from typing import Any, Optional, Tuple

from loguru import logger

CAMERA_STATUSES = ("OK", "NO_SOURCE", "AUTH_FAILED", "UNREACHABLE", "NO_FRAMES")


def parse_source_version(message: Any, device_id: str) -> Optional[int]:
    """camera_source_version of this device's config; None = the message says nothing about the camera address."""
    if not isinstance(message, dict) or message.get("deviceId") not in (None, device_id):
        return None
    version = message.get("camera_source_version")
    if isinstance(version, bool) or not isinstance(version, int) or version < 0:
        return None
    return version


def classify_ffprobe(returncode: int, stderr: str) -> str:
    """Why the stream could not be read, from ffprobe's answer."""
    text = stderr.lower()
    if "401" in text or "unauthorized" in text:
        return "AUTH_FAILED"
    # ffprobe opened the stream: the camera answers, OpenCV just got no frames
    return "NO_FRAMES" if returncode == 0 else "UNREACHABLE"


def probe_camera(url: str, timeout_sec: float) -> str:
    try:
        result = subprocess.run(["ffprobe", "-v", "error", "-rtsp_transport", "tcp", "-i", url],
                                capture_output=True, text=True, timeout=timeout_sec)
    except subprocess.TimeoutExpired:
        return "UNREACHABLE"
    except FileNotFoundError:
        logger.warning("ffprobe not found: cannot tell a wrong camera password from an unreachable camera")
        return "UNREACHABLE"
    return classify_ffprobe(result.returncode, result.stderr)


def fetch_source(api_base: str, device_id: str, secret: str, timeout: float = 10) -> Tuple[int, Optional[str]]:
    """(version, rtsp_url) of this AI node; (0, None) while it is not attached to a house or has no address yet."""
    token = base64.b64encode(f"{device_id}:{secret}".encode()).decode()
    request = urllib.request.Request(f"{api_base.rstrip('/')}/agent/camera-source", headers={"Authorization": f"Basic {token}"})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            data = json.load(response)["data"]
    except urllib.error.HTTPError as err:
        if err.code == 404:
            return 0, None
        raise
    return int(data["version"]), data.get("rtsp_url")


class CameraSource:
    """Fixed (CAMERA_RTSP_URL or --source) or managed by the backend. The frame grabber reads url() at every (re)connect
    and reopens when `changed` is set; status goes into the heartbeat."""

    def __init__(self, fixed_url: Optional[str] = None, api_base: Optional[str] = None,
                 device_id: str = "", secret: str = "", retry_sec: float = 30):
        self._lock = threading.Lock()
        self._url = fixed_url
        self._version = -1
        self._api_base, self._device_id, self._secret = api_base, device_id, secret
        self._retry_sec = retry_sec
        self._refresh = threading.Event()
        self.changed = threading.Event()
        self.status = "UNREACHABLE" if fixed_url else "NO_SOURCE"

    @property
    def managed(self) -> bool:
        return self._api_base is not None

    def url(self) -> Optional[str]:
        with self._lock:
            return self._url

    def start(self) -> None:
        if self.managed:
            self._refresh.set()
            threading.Thread(target=self._refresher, daemon=True).start()

    def on_message(self, payload: bytes) -> None:
        """Retained config from the MQTT thread: a new version means the Farm Owner changed the address."""
        try:
            version = parse_source_version(json.loads(payload), self._device_id)
        except ValueError:
            return
        if self.managed and version is not None and version != self._version:
            self._refresh.set()

    def _refresher(self) -> None:
        while True:
            self._refresh.wait()
            try:
                version, url = fetch_source(self._api_base or "", self._device_id, self._secret)
            except (OSError, ValueError, KeyError) as err:   # URLError is an OSError
                logger.warning(f"Could not fetch the camera address from the backend ({type(err).__name__}), retrying")
                threading.Event().wait(self._retry_sec)
                continue
            self._refresh.clear()
            with self._lock:
                is_new = url != self._url
                self._url, self._version = url, version
            if is_new:
                logger.info(f"Camera address version {version} from the backend" if url else "No camera address entered yet")
                self.changed.set()
