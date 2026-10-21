# ai-pipeline/CLAUDE.md

Rules and map for `ai-pipeline/` (Python: OpenCV + YOLO26n on ONNX Runtime + ByteTrack, bird in/out counting). This file wins over the root `CLAUDE.md` for pipeline code; `/review-pr` judges pipeline changes by it together with `ai-pipeline/README.md`. Rule tags: **[Bắt buộc]** = blocking (review requests changes), **[Nên]** = advisory. Only lines a PR adds or changes are judged; "Known debt" lists what is already out of line.

## Where the pipeline stands

- **Design source:** `docs/bird-counting-plan.md` is the implementation plan (architecture, config, MQTT payloads, training, accuracy measurement, backend and frontend work). Requirements: SRS §5.4 (Module VISION) and §0 scope. When the plan and this file disagree on *what to build*, the plan wins; this file wins on *how code must be written and checked*.
- **Scope (SRS v2.0.0 §0):** one class, `swiftlet`. Predator detection is removed. The AI node is a PC or cloud VPS (container `vision`), **not** a Raspberry Pi. An annotated live stream (boxes drawn on the frame, viewed over WebRTC via MediaMTX) and a counting-accuracy report split by lighting (VISION-FR-014/016) are required.
- **State:** a scaffold, never run for real. There is no `models/` folder (weights are never committed), `tracker.py` is a stub that returns nothing, `stream.py` publishes nothing, and the code still carries the v1 four-class/Raspberry Pi design — see Known debt. The backend's `mqtt/handlers/birdCount.handler.ts` is also a stub (logs only), so nothing persists bird counts end-to-end yet.

## Commands

```bash
cd ai-pipeline
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
python src/stream.py --config config/config.yaml       # current scaffold entry point
pytest tests/                                          # ring counter + calibration tool, no camera/model needed
python tools/pick_roi.py [image|clip|rtsp] --margin 60  # click the hole outline → prints roi + ring for config.yaml (plan §6.8)
```

Once rewritten per the plan (§6.6, §7.7), `stream.py` also takes `--source <clip|rtsp>`, `--session MORNING_EXIT|EVENING_ENTRY` and `--no-mqtt`, and serves an MJPEG preview at `http://127.0.0.1:8090/stream` for tuning ROI and the counting line. Python 3.11–3.12 (`onnxruntime` 1.30 needs ≥ 3.11; versions pinned in plan §4). The pipeline has no CI job yet.

## Structure

Today:
```
config/config.yaml    camera, model, classes, tracking, MQTT, storage, sessions
requirements.txt
src/
  stream.py           RTSP loop (sequential cap.read, no publishing)
  inference.py        YOLOv8-style ONNX inference + NMS (plan §6.3 also reads YOLO26n NMS-free output)
  tracker.py          ByteTrack stub
  counting.py         RingCounter: closed ring around the entrance hole, every crossing counted both ways
tools/pick_roi.py     calibration: hole outline → ring (offset by --margin) + ROI, printed as YAML
tools/extract_frames.py  clip → ROI-cropped frames + draft YOLO labels (ROI from config.yaml)
tools/split_by_day.py    labelled export → train/val/test by recording day + data.yaml
tests/                test_counting.py, test_pick_roi.py, test_dataset_tools.py
  alert_publisher.py  MQTT publisher for predator alerts (out of scope)
```

Target (plan §4): `src/inference.py` (fixed), `src/counting.py` (done: `RingCounter`, plan §3.3 item 7 / §19.8; `sv.LineZone` only for a camera that sees the hole side-on), `src/mjpeg_server.py` (new, dev preview), `src/stream.py` (rewritten: latest-frame reader thread, session switching, drawing, MQTT, push to MediaMTX). `tracker.py` and `alert_publisher.py` go away (ByteTrack comes from `supervision`). Not committed: `.env`, `models/`, `clips/`, `dataset/`, `logs/`, `state.json` — clips, frames and datasets live on `D:\SwiftletCare\` (plan §7.1).

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
| `config/config.yaml` | Four classes + `predator_classes`/`predator_confidence_min`; `rtsp_url` with placeholder credentials in the file; MQTT username `rpi-node-01`; `return_rate_drop_threshold` (the backend owns that) | Replace with the plan §6.2 config; move the URL to `.env` |
| `requirements.txt` | Raspberry Pi comments; ByteTrack built from source (`cython`, `lap`); MinIO/boto3 | Replace with the plan §4 list (`supervision`, `loguru`, `python-dotenv`, `pytest`) |
| `src/inference.py` | No BGR→RGB conversion; decodes only the YOLOv8 `(1, nc+4, 8400)` output, while the plan exports YOLO26n with `nms=False` (`(1, 300, 6)`, no NMS) and compares YOLOv8n/YOLO11n/YOLO26n (plan §7.9); hard-coded `CLASS_NAMES`/`PREDATOR_IDS`; fixed 4 threads; CPU provider only | Plan §6.3 |
| `src/tracker.py` | Stub — `update()` returns an empty list, so nothing is ever counted | Delete; use `sv.ByteTrack` |
| `src/stream.py` | Sequential `cap.read()` (lags), no MQTT, no sessions, no drawing, no stream push | Rewrite (plan §6.6) |
| `src/alert_publisher.py` | Predator alerts, payload without `deviceId` | Delete (out of scope) |
| `README.md` | Lists `vision/alert` and `vision/heartbeat` topics; the backend listens on `.../heartbeat` and predator alerts are gone | Fix with the first code PR |
| CI | `tests/` exists but no CI job runs it | Add a CI job running `pytest` |

A PR that touches a file in this table **should** pay the debt; it **must** when it makes the debt worse (e.g. adding a predator class or a secret to `config.yaml`).

## Before opening a PR

- **[Bắt buộc]** `pytest tests/` passes (once tests exist); the pipeline runs on at least one clip with `--no-mqtt` and the PR states the resulting counts.
- **[Bắt buộc]** For a payload or topic change: checked against `backend/src/mqtt/mqtt.client.ts`, `BirdCountPayload` and `docs/api/api-spec.yaml`, and tested end-to-end against a local EMQX + backend when the backend handler exists.
- **[Bắt buộc]** For a model, threshold or counting change: before/after numbers on the same clips, following the accuracy rule above.
- **[Bắt buộc]** No weights, clips, datasets or `.env` in the diff.
- **[Bắt buộc]** PR fills `.github/pull_request_template.md`; commits follow `.commitlintrc.json` (scope `vision`; `rpi` is a leftover from the Raspberry Pi design).
