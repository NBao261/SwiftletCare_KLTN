# ai-pipeline/CLAUDE.md

Rules and map for `ai-pipeline/` (Python: OpenCV + YOLO26n on ONNX Runtime + ByteTrack, bird in/out counting). This file wins over the root `CLAUDE.md` for pipeline code; `/review-pr` judges pipeline changes by it together with `ai-pipeline/README.md`. Rule tags: **[Bắt buộc]** = blocking (review requests changes), **[Nên]** = advisory. Only lines a PR adds or changes are judged; "Known debt" lists what is already out of line.

## Where the pipeline stands

- **Design source:** `docs/bird-counting-plan.md` is the implementation plan (architecture, config, MQTT payloads, training, accuracy measurement, backend and frontend work). Requirements: SRS §5.4 (Module VISION) and §0 scope. When the plan and this file disagree on *what to build*, the plan wins; this file wins on *how code must be written and checked*.
- **Scope (SRS v2.0.0 §0):** one class, `swiftlet`. Predator detection is removed. The AI node is a PC or cloud VPS (container `vision`), **not** a Raspberry Pi. An annotated live stream (boxes drawn on the frame, viewed over WebRTC via MediaMTX) and a counting-accuracy report split by lighting (VISION-FR-014/016) are required.
- **State:** a scaffold, never run for real. There is no `models/` folder (weights are never committed), `stream.py` tracks every bird over the whole frame (2 tiles → YOLO → ByteTrack → ring count) but publishes nothing, and the code still carries the v1 four-class/Raspberry Pi design — see Known debt. The backend's `mqtt/handlers/birdCount.handler.ts` is also a stub (logs only), so nothing persists bird counts end-to-end yet.

## Commands

```bash
cd ai-pipeline
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
python src/stream.py                                   # live: CAMERA_RTSP_URL from .env
pytest tests/                                          # no camera, model or broker needed
python tools/pick_roi.py [image|clip|rtsp] --margin 60  # click the hole outline → prints the ring for config.yaml (plan §6.8)
python tools/track_clip.py <clip> --start 425 --seconds 20 [--detector motion]  # video with green boxes → D:/SwiftletCare/clips/annotated
```

Once rewritten per the plan (§6.6, §7.7), `stream.py` also takes `--source <clip|rtsp>`, `--session MORNING_EXIT|EVENING_ENTRY` and `--no-mqtt`, and serves an MJPEG preview at `http://127.0.0.1:8090/stream`. Python 3.11–3.12 (`onnxruntime` 1.30 needs ≥ 3.11; versions pinned in plan §4). The pipeline has no CI job yet.

## Structure

Today:
```
config/config.yaml    camera (tiles, mask), model, classes, tracking (ring, extrapolation), MQTT, sessions
requirements.txt
src/
  stream.py           RTSP loop (sequential cap.read, no publishing) around pipeline.py
  pipeline.py         FramePipeline: mask → 2 tiles → YOLO → sv.ByteTrack → RingCounter → draw (green boxes)
  frame_prep.py       mask + tiles, shared with the dataset tools so training and production see the same pixels
  inference.py        ONNX inference, YOLO26 (300, 6) and YOLOv8/11 outputs, per-tile run + merge
  counting.py         RingCounter: ring crossings both ways + extrapolation for birds too fast at the hole; set_ring() swaps it live
  remote_config.py    VISION-FR-018: ring drawn by the Domain Expert, from {house}/config/update → state/counting_ring.json
tools/pick_roi.py     calibration: hole outline → ring (offset by --margin), printed as YAML
tools/extract_frames.py  clip → masked 2-tile frames + draft YOLO labels (tiles from config.yaml)
tools/track_clip.py  clip segment → video with green boxes + counts; --detector motion until a trained model exists
tools/split_by_day.py    labelled export → train/val/test by recording day + data.yaml
tests/                test_counting.py, test_inference.py, test_frame_prep.py, test_pick_roi.py, test_dataset_tools.py, test_remote_config.py
```

Target (plan §4): `src/mjpeg_server.py` (new, dev preview), `src/stream.py` (rewritten: latest-frame reader thread, session switching, MQTT, push to MediaMTX). Done: `inference.py` (plan §6.3), `counting.py` (`RingCounter`, plan §3.3 item 7 / §19.8), tracking with `sv.ByteTrack` in `pipeline.py`. Not committed: `.env`, `models/`, `clips/`, `dataset/`, `logs/`, `state.json`, `state/` (the last counting ring received) — clips, frames and datasets live on `D:\SwiftletCare\` (plan §7.1).

## Rules

### Scope and parameters
- **[Bắt buộc]** One detection class, `swiftlet`. Nothing new for predators (rat/snake/owl), `PREDATOR_DETECTED` or `vision/alert`; code a PR touches that still refers to them is removed, not extended.
- **[Bắt buộc]** Class map, confidence/NMS thresholds, ROI, counting line and direction, session windows, publish intervals and model path come from `config/config.yaml` — no magic numbers in `src/`. A new tunable goes into the config with a comment.
- **[Bắt buộc]** No threshold or behaviour invented without a source (SRS, plan, Domain Expert, a measured result). A value picked by hand is labelled as such in the config comment and, if it reaches users or the backend, listed with the unconfirmed assumptions at the end of SRS §0.5.
- **[Bắt buộc]** Runtime targets the plan's stack: `onnxruntime` + `supervision` (ByteTrack, `LineZone`) — no `torch`/`ultralytics` in `requirements.txt` (they are for training on Colab only). New dependencies are pinned with a lower bound like the existing ones.

### Secrets, data and models
- **[Bắt buộc]** Camera RTSP URL (it carries the camera password), MQTT credentials, `STREAM_PUSH_URL` and the farm/house/zone/device IDs come from `.env` (`CAMERA_RTSP_URL`, `MQTT_USERNAME`/`MQTT_PASSWORD`, `STREAM_PUSH_URL`, `CAMERA_DEVICE_ID`, `FARM_ID`, `HOUSE_ID`, `ZONE_ID`), never from `config.yaml` or code. A new variable is added to an `.env.example` with a placeholder.
- **[Bắt buộc]** Never commit model weights (`*.onnx`, `*.pt`), clips, frames, datasets, `.env`, logs or `state.json`; extend `.gitignore` when a new artifact folder appears. Record which model version runs (`model.version` in the config, sent as `firmwareVersion` in the heartbeat).
- **[Bắt buộc]** Anything leaving the machine uses TLS in deploy mode (MQTT 8883, `rtsps://` push). The MJPEG preview binds to `127.0.0.1` only; remote viewers go through MediaMTX with backend-checked access.

### MQTT contract with the backend
- **[Bắt buộc]** Topics are `swiftletcare/{farmId}/{houseId}/{zoneId}/vision/bird-count` and `swiftletcare/{farmId}/{houseId}/{zoneId}/heartbeat` (what `backend/src/mqtt/mqtt.client.ts` subscribes to), using the real MongoDB ObjectIds.
- **[Bắt buộc]** Every payload carries `deviceId` = the CameraNode `device_id` registered in the backend; the backend looks the device up by it, not by the topic segments.
- **[Bắt buộc]** Payload shapes follow the plan (§6.6) and the backend's `BirdCountPayload` (`backend/src/types/domain.types.ts`, extended per plan §8.2): session message `{deviceId, session_type, entry_count, exit_count, confidence_avg, final, timestamp}`; bucket message `{deviceId, kind: "BUCKET", bucket_start, bucket_minutes, entry_count, exit_count, timestamp}`; heartbeat `{deviceId, firmwareVersion}`. Timestamps are epoch milliseconds. Counts are non-negative integers. A field change lands together with the backend type, the handler and `docs/api/api-spec.yaml` (or names the PR that does).
- **[Bắt buộc]** The one message the node receives is `swiftletcare/{farmId}/{houseId}/config/update` with `{deviceId, counting_ring: {points, into_ring_is_exit}}` (VISION-FR-018, `remote_config.py`): drop it when `deviceId` names another camera, validate it with the same limits as the backend route (3–12 vertices in 0–1), and keep counting with the old ring when it is malformed.
- **[Bắt buộc]** The pipeline sends raw entry/exit counts; the backend computes the return rate on **net** counts (VISION-FR-009). Do not compute or send `return_rate` from the pipeline.
- **[Nên]** Publish with QoS 1 for counts and QoS 0 for heartbeats; reconnect with `connect_async` + `loop_start` so a broker outage does not stop counting.

### Reliability
- **[Bắt buộc]** The process survives a dropped camera or broker: reconnect with back-off instead of exiting, and run under a supervisor that restarts it on crash (Docker `restart: unless-stopped` or a service manager — REL-NFR-004).
- **[Bắt buộc]** Frame reading never lags behind real time: keep only the latest frame (reader thread), do not process a growing backlog.
- **[Nên]** Counts in progress survive a restart within the same session (`state.json`, plan §6.6).

### Code quality
- **[Bắt buộc]** Logging via `loguru` with file rotation from the config — no `print` in `src/` (a CLI result line in an evaluation run is the exception).
- **[Bắt buộc]** Type hints on public functions and classes; no bare `except:` — catch specific errors or log and re-raise.
- **[Bắt buộc]** Counting logic (line crossing, direction, session switching, bucket rollover, net count inputs) has `pytest` tests that run without a camera, model or broker.
- **[Nên]** Keep `src/` modules importable without side effects (no work at import time); entry points behind `if __name__ == "__main__":`.

### Accuracy claims
- **[Bắt buộc]** Any accuracy number in a PR, README or report comes from the plan §7.7 procedure: clips from test days only (never days used for training), hand counts by two people, error per direction and for the net count, reported **separately** for well-lit and low-light clips (VISION-FR-016), with model Precision/Recall on the test split. State the conditions; never round a miss into a pass.

## Known debt — not held against PRs that don't touch it

| Where | Out of line | How to pay it |
|---|---|---|
| `config/config.yaml` | MQTT username `rpi-node-01`; `mqtt.farm_id/house_id/zone_id` placeholders (IDs come from `.env`) | Replace the `mqtt` block with plan §6.2 |
| `src/pipeline.py` | `sv.ByteTrack` is deprecated and removed in supervision 0.31 (pinned `<0.31`) | Move to the `trackers` package before upgrading |
| `src/stream.py` | Sequential `cap.read()` (lags), no MQTT, no sessions, no stream push | Rewrite (plan §6.6) |
| `README.md` | Lists `vision/alert` and `vision/heartbeat` topics; the backend listens on `.../heartbeat` and predator alerts are gone | Fix with the first code PR |
| CI | `tests/` exists but no CI job runs it | Add a CI job running `pytest` |

A PR that touches a file in this table **should** pay the debt; it **must** when it makes the debt worse (e.g. adding a predator class or a secret to `config.yaml`).

## Before opening a PR

- **[Bắt buộc]** `pytest tests/` passes (once tests exist); the pipeline runs on at least one clip with `--no-mqtt` and the PR states the resulting counts.
- **[Bắt buộc]** For a payload or topic change: checked against `backend/src/mqtt/mqtt.client.ts`, `BirdCountPayload` and `docs/api/api-spec.yaml`, and tested end-to-end against a local EMQX + backend when the backend handler exists.
- **[Bắt buộc]** For a model, threshold or counting change: before/after numbers on the same clips, following the accuracy rule above.
- **[Bắt buộc]** No weights, clips, datasets or `.env` in the diff.
- **[Bắt buộc]** PR fills `.github/pull_request_template.md`; commits follow `.commitlintrc.json` (scope `vision`; `rpi` is a leftover from the Raspberry Pi design).
