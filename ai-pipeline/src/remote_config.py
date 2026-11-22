"""Ring and session windows from the backend's retained config, kept in files to survive a restart without the broker."""
import json
import os
import re
import threading
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

from loguru import logger

Point = Tuple[float, float]
Ring = Tuple[List[Point], bool]   # points as frame ratios, into_ring_is_exit
Windows = Dict[str, Tuple[str, str]]   # session type -> ("HH:MM", "HH:MM"), like sessions.windows in config.yaml

SESSIONS = ("MORNING_EXIT", "EVENING_ENTRY")
TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

# 3 = smallest closed ring; 12 vertices and 4 rings = the backend validator's limits
MIN_POINTS = 3
MAX_POINTS = 12
MAX_RINGS = 4


def parse_rings(message: Any, device_id: str) -> Optional[List[Ring]]:
    """This camera's rings; [] = deleted, use the config.yaml ring; None = the message says nothing about rings."""
    if not isinstance(message, dict):
        return None
    if message.get("deviceId") not in (None, device_id):  # same rule as the ESP32
        return None
    if "counting_rings" in message:
        rings = message["counting_rings"]
        if not isinstance(rings, list) or len(rings) > MAX_RINGS:
            raise ValueError(f"counting_rings needs 0-{MAX_RINGS} rings")
        return [parse_ring(ring) for ring in rings]
    if message.get("counting_ring") is not None:   # older backend: one ring
        return [parse_ring(message["counting_ring"])]
    return None


def parse_ring(ring: Any) -> Ring:
    """One ring object; ValueError when it is malformed."""
    if not isinstance(ring, dict):
        raise ValueError("a counting ring must be an object")
    points = ring.get("points")
    if not isinstance(points, list) or not MIN_POINTS <= len(points) <= MAX_POINTS:
        raise ValueError(f"points needs {MIN_POINTS}-{MAX_POINTS} vertices")
    parsed: List[Point] = []
    for p in points:
        ok = (isinstance(p, (list, tuple)) and len(p) == 2
              and all(isinstance(v, (int, float)) and not isinstance(v, bool) and 0 <= v <= 1 for v in p))
        if not ok:
            raise ValueError(f"vertex {p!r} is not [x, y] in 0-1")
        parsed.append((float(p[0]), float(p[1])))
    into_ring_is_exit = ring.get("into_ring_is_exit")
    if not isinstance(into_ring_is_exit, bool):
        raise ValueError("into_ring_is_exit must be true or false")
    return parsed, into_ring_is_exit


class RingStore:
    """The MQTT thread hands rings in with on_message(); the frame loop picks them up with take_update()."""

    def __init__(self, path: Path, device_id: str):
        self._path = Path(path)
        self._device_id = device_id
        self._lock = threading.Lock()
        self._pending: Optional[List[Ring]] = None

    def load(self) -> Optional[List[Ring]]:
        """The rings saved by an earlier run, or None to use the config.yaml ring."""
        try:
            saved = json.loads(self._path.read_text(encoding="utf-8"))
            # A file from before multiple rings holds one ring object
            message = {"counting_rings": saved["rings"]} if isinstance(saved, dict) and "rings" in saved else {"counting_ring": saved}
            return parse_rings(message, self._device_id) or None
        except FileNotFoundError:
            return None
        except (OSError, ValueError) as err:
            logger.warning(f"Ignoring saved counting rings {self._path}: {err}")
            return None

    def on_message(self, payload: bytes) -> None:
        try:
            rings = parse_rings(json.loads(payload), self._device_id)
        except ValueError as err:   # JSONDecodeError is a ValueError
            logger.warning(f"Ignoring counting rings from the backend: {err}")
            return
        if rings is None:
            return
        if rings:
            self._path.parent.mkdir(parents=True, exist_ok=True)
            saved = [{"points": points, "into_ring_is_exit": into} for points, into in rings]
            self._path.write_text(json.dumps({"rings": saved}), encoding="utf-8")
        else:
            self._path.unlink(missing_ok=True)
        with self._lock:
            self._pending = rings
        logger.info(f"Counting rings from the backend: {len(rings) or 'none, back to the config.yaml ring'}")

    def take_update(self) -> Optional[List[Ring]]:
        """None = nothing new; [] = rings deleted, use the config.yaml ring."""
        with self._lock:
            rings, self._pending = self._pending, None
        return rings


def parse_windows(message: Any, device_id: str) -> Optional[Dict[str, Windows]]:
    """Session windows per Vietnam date, or None; ValueError when a date or window is malformed."""
    if not isinstance(message, dict) or message.get("deviceId") not in (None, device_id):
        return None
    by_date = message.get("session_windows")
    if by_date is None:
        return None
    if not isinstance(by_date, dict):
        raise ValueError("session_windows must be an object")
    parsed: Dict[str, Windows] = {}
    for date, windows in by_date.items():
        if not DATE_RE.match(str(date)) or not isinstance(windows, dict):
            raise ValueError(f"bad session windows for {date!r}")
        day: Windows = {}
        for session in SESSIONS:
            window = windows.get(session)
            ok = (isinstance(window, (list, tuple)) and len(window) == 2
                  and all(isinstance(t, str) and TIME_RE.match(t) for t in window) and window[0] < window[1])
            if not ok:
                raise ValueError(f"{session} of {date} is not [start, end] in HH:MM with start before end")
            day[session] = (window[0], window[1])
        parsed[str(date)] = day
    return parsed


class ScheduleStore:
    """Session windows per date from the backend; on_message() runs in the MQTT thread, windows_on() in the frame loop."""

    def __init__(self, path: Path, device_id: str):
        self._path = Path(path)
        self._device_id = device_id
        self._lock = threading.Lock()
        self._by_date: Dict[str, Windows] = {}

    def load(self) -> None:
        """Windows saved by an earlier run, so a restart without the broker still counts in the right windows."""
        try:
            saved = parse_windows({"session_windows": json.loads(self._path.read_text(encoding="utf-8"))}, self._device_id)
        except FileNotFoundError:
            return
        except (OSError, ValueError) as err:
            logger.warning(f"Ignoring saved session windows {self._path}: {err}")
            return
        with self._lock:
            self._by_date = saved or {}

    def on_message(self, payload: bytes) -> None:
        try:
            by_date = parse_windows(json.loads(payload), self._device_id)
        except ValueError as err:   # JSONDecodeError is a ValueError
            logger.warning(f"Ignoring session windows from the backend: {err}")
            return
        if by_date is None:
            return
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._path.write_text(json.dumps(by_date), encoding="utf-8")
        with self._lock:
            self._by_date = by_date
        logger.info(f"Session windows from the backend for {len(by_date)} days, from {min(by_date, default='-')}")

    def windows_on(self, date: str, default: Windows) -> Windows:
        """The windows of that Vietnam date, or the config.yaml windows when the backend sent none for it."""
        with self._lock:
            return self._by_date.get(date, default)


def dispatch_config(stores: Sequence[Any], payload: bytes) -> None:
    """Hand one config message to every store; one failing (disk full while saving the ring) must not starve the others."""
    for store in stores:
        try:
            store.on_message(payload)
        except Exception:
            logger.exception(f"{type(store).__name__} could not apply the config")


def start_listener(mqtt_cfg: dict, stores: Sequence[Any], device_id: str) -> Any:
    """Subscribe to this device's retained config in a background thread; each store reads its own part."""
    import paho.mqtt.client as mqtt   # only needed when the node talks to a broker

    topic = f"swiftletcare/dev/{device_id}/config"
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=f"SC-{device_id}-config")
    client.username_pw_set(device_id, os.environ["MQTT_PASSWORD"])
    if mqtt_cfg.get("tls"):  # deploy mode: Let's Encrypt cert from the OS's CA store, as stream.Publisher
        client.tls_set()
    # Subscribing in on_connect re-subscribes after every reconnect (clean session)
    client.on_connect = lambda c, _userdata, _flags, _reason, _props: c.subscribe(topic, qos=1)
    client.on_message = lambda _c, _userdata, msg: dispatch_config(stores, msg.payload)
    client.reconnect_delay_set(min_delay=1, max_delay=60)
    client.connect_async(mqtt_cfg["broker"], mqtt_cfg["port"])
    client.loop_start()
    logger.info(f"Listening for the counting ring and session windows on {topic}")
    return client
