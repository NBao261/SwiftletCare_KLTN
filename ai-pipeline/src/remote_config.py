"""
SwiftletCare - counting ring sent by the backend (VISION-FR-018)

The Domain Expert draws the ring on the web; the backend publishes
{deviceId, counting_ring: {points, into_ring_is_exit}} on
swiftletcare/{farmId}/{houseId}/config/update, and again whenever this node
reconnects (the message is not retained). The last ring received is kept in a
file so a restart without the broker still counts with it; with no file, the
ring in config.yaml is used.

SRS: VISION-FR-018; plan §3.3 item 7, §19.8
"""
import json
import os
import threading
from pathlib import Path
from typing import Any, List, Optional, Tuple

from loguru import logger

Point = Tuple[float, float]
Ring = Tuple[List[Point], bool]   # points as frame ratios, into_ring_is_exit

# 3 = smallest closed ring; 12 = the backend validator's technical limit (SRS 0.5)
MIN_POINTS = 3
MAX_POINTS = 12


def parse_ring(message: Any, device_id: str) -> Optional[Ring]:
    """
    The ring in a config/update message for this camera. None when the message is
    addressed to another device or carries no ring; ValueError when the ring is malformed.
    """
    if not isinstance(message, dict):
        return None
    if message.get("deviceId") not in (None, device_id):   # same rule as the ESP32 (CLAUDE.md, MQTT)
        return None
    ring = message.get("counting_ring")
    if ring is None:
        return None
    if not isinstance(ring, dict):
        raise ValueError("counting_ring must be an object")
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
        self._pending: Optional[Ring] = None

    def load(self) -> Optional[Ring]:
        """The ring saved by an earlier run, or None (no file, or a file that no longer parses)."""
        try:
            return parse_ring({"counting_ring": json.loads(self._path.read_text(encoding="utf-8"))}, self._device_id)
        except FileNotFoundError:
            return None
        except (OSError, ValueError) as err:
            logger.warning(f"Ignoring saved counting ring {self._path}: {err}")
            return None

    def on_message(self, payload: bytes) -> None:
        try:
            ring = parse_ring(json.loads(payload), self._device_id)
        except ValueError as err:   # JSONDecodeError is a ValueError
            logger.warning(f"Ignoring counting ring from the backend: {err}")
            return
        if ring is None:
            return
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._path.write_text(json.dumps({"points": ring[0], "into_ring_is_exit": ring[1]}), encoding="utf-8")
        with self._lock:
            self._pending = ring
        logger.info(f"New counting ring from the backend: {len(ring[0])} vertices, into_ring_is_exit={ring[1]}")

    def take_update(self) -> Optional[Ring]:
        with self._lock:
            ring, self._pending = self._pending, None
        return ring


def start_listener(mqtt_cfg: dict, store: RingStore, farm_id: str, house_id: str, device_id: str) -> Any:
    """Subscribe to the house's config/update in a background thread; reconnects on its own."""
    import paho.mqtt.client as mqtt   # only needed when the node talks to a broker

    topic = f"swiftletcare/{farm_id}/{house_id}/config/update"
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=f"SC-{device_id}-config")
    if os.environ.get("MQTT_USERNAME"):
        client.username_pw_set(os.environ["MQTT_USERNAME"], os.environ.get("MQTT_PASSWORD"))
    if mqtt_cfg.get("tls"):   # deploy mode (SEC-NFR-001): Let's Encrypt cert, the OS's CA store, as stream.Publisher
        client.tls_set()
    # Subscribing in on_connect re-subscribes after every reconnect (clean session)
    client.on_connect = lambda c, _userdata, _flags, _reason, _props: c.subscribe(topic, qos=1)
    client.on_message = lambda _c, _userdata, msg: store.on_message(msg.payload)
    client.reconnect_delay_set(min_delay=1, max_delay=60)
    client.connect_async(mqtt_cfg["broker"], mqtt_cfg["port"])
    client.loop_start()
    logger.info(f"Listening for counting rings on {topic}")
    return client
