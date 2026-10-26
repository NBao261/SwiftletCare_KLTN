# ai-pipeline/CLAUDE.md

Rules and map for `ai-pipeline/` (Python: OpenCV + YOLO26n on ONNX Runtime + ByteTrack, bird in/out counting). This file wins over the root `CLAUDE.md` for pipeline code; `/review-pr` judges pipeline changes by it together with `ai-pipeline/README.md`. Rule tags: **[Bắt buộc]** = blocking (review requests changes), **[Nên]** = advisory. Only lines a PR adds or changes are judged; "Known debt" lists what is already out of line.

## Where the pipeline stands

- **Design source:** `docs/bird-counting-plan.md` is the implementation plan (architecture, config, MQTT payloads, training, accuracy measurement, backend and frontend work). Requirements: Report 3 §3.8 (VISION-FR) and §8 (out of scope) in `docs/reports/report3-srs.md`; design: Report 4 §5.2 and D5/D6 (`docs/reports/report4-sdd.md`). Report 3 wins over `SwiftletCare_SRS.md`. When the plan and this file disagree on *what to build*, the plan wins; this file wins on *how code must be written and checked*.
- **Scope (Report 3 §1.2, §8):** one class, `swiftlet`. Predator detection is removed. The AI node is the team's spare desktop PC at a member's home (Report 4 D5, §11), **not** a Raspberry Pi: it pulls the camera's RTSP feed over the Internet (TCP, through the port forwarded on the house modem's static IP), reaches the staging VPS over MQTT TLS 8883 and pushes the annotated stream to MediaMTX over RTSPS. The camera URL and password live only in its `.env`. Throughput (NFR-04) is measured on that PC. An annotated live stream (boxes drawn on the frame, viewed over WebRTC via MediaMTX) and a counting-accuracy report split by lighting (VISION-FR-014/016) are required.
- **Sessions per Report 3:** the backend computes a session as the sum of the 5-minute counts inside the windows in force that day — the house's seasonal profile or a temporary window set by the Domain Expert, else the defaults of BR-13 (VISION-FR-008, 019, 020). The 5-minute bucket messages are therefore the output the return rate depends on; the session windows in `config.yaml` are only the defaults. The backend side of this is not built yet (`docs/reports/project-tracking.md` §6 G-12).
- **State:** runs on recorded clips and on the real camera (VIGI C320I, 25 fps) with a temporary COCO `yolo26n`, which does not find swiftlets in the IR frames; no self-trained model yet and not deployed. `stream.py` tracks every bird over the whole frame (2 tiles → YOLO → ByteTrack → ring count), publishes session counts, 5-minute buckets and heartbeats over MQTT, serves an MJPEG preview and pushes the annotated stream to MediaMTX. Weights are never committed (`models/` is git-ignored). The backend side is ready: `mqtt/handlers/birdCount.handler.ts` → `services/birdCount.service.ts` stores session records and 5-minute buckets and raises `LOW_RETURN_RATE`, and the AI node's heartbeat and `EDGE_AI_DEGRADED` are handled.

## Commands

```bash
cd ai-pipeline
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
python src/stream.py                                   # live: CAMERA_RTSP_URL from .env; preview http://127.0.0.1:8090/stream
python src/stream.py --source <clip> --session EVENING_ENTRY --no-mqtt   # on a clip, prints KẾT QUẢ
pytest                                                 # no camera, model or broker needed (pytest.ini sets src/ and tests/)
python tools/pick_roi.py [image|clip|rtsp] --margin 60  # click the hole outline → prints the ring for config.yaml (plan §6.8)
python tools/track_clip.py <clip> --start 425 --seconds 20 [--detector motion]  # video with green boxes → D:/SwiftletCare/clips/annotated
```

`stream.py` takes `--source <clip|rtsp>`, `--session MORNING_EXIT|EVENING_ENTRY`, `--realtime` (play a file at real speed, camera demo) and `--no-mqtt`. Python 3.11–3.12 (`onnxruntime` 1.30 needs ≥ 3.11; versions pinned in plan §4). CI runs `pytest` for PRs that touch `ai-pipeline/`.

## Structure

Today:
```
config/config.yaml    camera (source, tiles, mask), model, classes, tracking (ring, extrapolation), sessions, MQTT, push, MJPEG
.env.example          RTSP URL, device/farm/house ids, MQTT login, STREAM_PUSH_URL (copy to .env, never committed)
pytest.ini
requirements.txt
src/
  stream.py           live loop: latest-frame reader, sessions in Vietnam time, state.json, MQTT publisher, 5-minute buckets
  pipeline.py         FramePipeline: mask → 2 tiles → YOLO → sv.ByteTrack; draw() green boxes, ring, counts
  mjpeg_server.py     MJPEG preview on 127.0.0.1 (encodes only while someone watches)
  stream_pusher.py    pushes the annotated frames to MediaMTX with ffmpeg; masks the password in its logs
  frame_prep.py       mask + tiles, shared with the dataset tools so training and production see the same pixels
  inference.py        ONNX inference, YOLO26 (300, 6) and YOLOv8/11 outputs, per-tile run + merge
  counting.py         RingCounter (ring crossings + extrapolation at the hole; set_ring() swaps it live), sessions, BucketClock
  remote_config.py    VISION-FR-018: ring drawn by the Domain Expert, from {house}/config/update → state/counting_ring.json
tools/pick_roi.py     calibration: hole outline → ring (offset by --margin), printed as YAML
tools/extract_frames.py  clip → masked 2-tile frames + draft YOLO labels from motion tracks (--draft tracks) or blobs
tools/track_clip.py  clip segment → video with green boxes + counts; --detector motion until a trained model exists
tools/split_by_day.py    labelled export → train/val/test by recording day + data.yaml
tools/record_session.ps1 daily clip recording (Task Scheduler 05:15/17:15) to D:\SwiftletCare\clips, remuxed to seekable mp4
tests/                counting, inference, frame_prep, state, stream_pusher, pick_roi, dataset_tools, remote_config
```

Not committed: `.env`, `models/`, `clips/`, `dataset/`, `logs/`, `state.json`, `state/` (the last counting ring received) — clips, frames and datasets live on `D:\SwiftletCare\` (plan §7.1).

## Rules

### Scope and parameters
- **[Bắt buộc]** One detection class, `swiftlet`. Nothing new for predators (rat/snake/owl) or `PREDATOR_DETECTED`; code a PR touches that still refers to them is removed, not extended. `vision/alert` carries only `EDGE_AI_DEGRADED` (THREAT-FR-010), the one alert type the backend accepts from a camera.
- **[Bắt buộc]** Class map, confidence/NMS thresholds, tiles and mask, counting ring and direction, tracking and extrapolation limits, session windows, publish intervals and model path come from `config/config.yaml` — no magic numbers in `src/`. A new tunable goes into the config with a comment.
- **[Bắt buộc]** No threshold or behaviour invented without a source (Report 3, plan, Domain Expert, a measured result). A value picked by hand is labelled as such in the config comment and listed in Report 3 §4.5 (engineering constants, A-4) in the same PR.
- **[Bắt buộc]** Runtime targets the plan's stack: `onnxruntime` + `supervision` (ByteTrack) — no `torch`/`ultralytics` in `requirements.txt` (they are for training on Colab only). New dependencies are pinned with a lower bound like the existing ones.

### Secrets, data and models
- **[Bắt buộc]** Camera RTSP URL (it carries the camera password), MQTT credentials, `STREAM_PUSH_URL` and the farm/house/device IDs come from `.env` (`CAMERA_RTSP_URL`, `MQTT_USERNAME`/`MQTT_PASSWORD`, `STREAM_PUSH_URL`, `CAMERA_DEVICE_ID`, `FARM_ID`, `HOUSE_ID`), never from `config.yaml` or code. A new variable is added to an `.env.example` with a placeholder.
- **[Bắt buộc]** Never commit model weights (`*.onnx`, `*.pt`), clips, frames, datasets, `.env`, logs or `state.json`; extend `.gitignore` when a new artifact folder appears. Record which model version runs (`model.version` in the config, sent as `firmwareVersion` in the heartbeat).
- **[Bắt buộc]** Anything leaving the machine uses TLS in deploy mode (MQTT 8883, `rtsps://` push). The MJPEG preview binds to `127.0.0.1` only; remote viewers go through MediaMTX with backend-checked access.

### MQTT contract with the backend
- **[Bắt buộc]** Topics are per house, with no zone segment (Report 3 §2.8: the camera watches the entrance of the whole house): `swiftletcare/{farmId}/{houseId}/vision/bird-count`, `swiftletcare/{farmId}/{houseId}/heartbeat` and `swiftletcare/{farmId}/{houseId}/vision/alert` (what `backend/src/mqtt/mqtt.client.ts` subscribes to), using the real MongoDB ObjectIds.
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
- **[Bắt buộc]** Counting logic (ring crossing, direction, extrapolation of fast tracks, ambiguous tracks, session switching, bucket rollover, net count inputs) has `pytest` tests that run without a camera, model or broker.
- **[Nên]** Keep `src/` modules importable without side effects (no work at import time); entry points behind `if __name__ == "__main__":`.

### Accuracy claims
- **[Bắt buộc]** Any accuracy number in a PR, README or report comes from the plan §7.7 procedure: clips from test days only (never days used for training), hand counts by two people, error per direction and for the net count, reported **separately** for well-lit and low-light clips (VISION-FR-016), with model Precision/Recall on the test split. State the conditions; never round a miss into a pass.

## Known debt — not held against PRs that don't touch it

| Where | Out of line | How to pay it |
|---|---|---|
| `src/pipeline.py` | `sv.ByteTrack` is deprecated and removed in supervision 0.31 (pinned `<0.31`) | Move to the `trackers` package before upgrading |

A PR that touches a file in this table **should** pay the debt; it **must** when it makes the debt worse (e.g. adding a predator class or a secret to `config.yaml`).

## Before opening a PR

- **[Bắt buộc]** `pytest` passes; the pipeline runs on at least one clip with `--no-mqtt` and the PR states the resulting counts.
- **[Bắt buộc]** For a payload or topic change: checked against `backend/src/mqtt/mqtt.client.ts`, `BirdCountPayload` and `docs/api/api-spec.yaml`, and tested end-to-end against a local EMQX + backend when the backend handler exists.
- **[Bắt buộc]** For a model, threshold or counting change: before/after numbers on the same clips, following the accuracy rule above.
- **[Bắt buộc]** No weights, clips, datasets or `.env` in the diff.
- **[Bắt buộc]** PR fills `.github/pull_request_template.md`; commits follow `.commitlintrc.json` (scope `vision`; `rpi` is a leftover from the Raspberry Pi design).
