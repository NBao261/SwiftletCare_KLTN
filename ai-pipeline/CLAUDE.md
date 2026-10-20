# ai-pipeline/CLAUDE.md

Rules and map for `ai-pipeline/` (Python: OpenCV + YOLO26n on ONNX Runtime + ByteTrack, bird in/out counting). This file wins over the root `CLAUDE.md` for pipeline code; `/review-pr` judges pipeline changes by it together with `ai-pipeline/README.md`. Rule tags: **[Bắt buộc]** = blocking (review requests changes), **[Nên]** = advisory. Only lines a PR adds or changes are judged; "Known debt" lists what is already out of line.

## Where the pipeline stands

- **Design source:** `docs/bird-counting-plan.md` is the implementation plan (architecture, config, MQTT payloads, training, accuracy measurement, backend and frontend work). Requirements: SRS §5.4 (Module VISION) and §0 scope. When the plan and this file disagree on *what to build*, the plan wins; this file wins on *how code must be written and checked*.
- **Scope (SRS v2.0.0 §0):** one class, `swiftlet`. Predator detection is removed. The AI node is a PC or cloud VPS (container `vision`), **not** a Raspberry Pi. An annotated live stream (boxes drawn on the frame, viewed over WebRTC via MediaMTX) and a counting-accuracy report split by lighting (VISION-FR-014/016) are required.
- **State:** GĐ1 of the plan (§6) is built: the pipeline runs on clips and on the real camera (VIGI C320I, 25 fps reached on a Ryzen 7 6800H laptop on 20/10/2026) with the temporary YOLO26n COCO model, and publishes the plan's MQTT payloads. With `STREAM_PUSH_URL` it pushes the annotated frames to MediaMTX (§15.6), checked end to end in dev with the real camera, the backend's stream token and a browser over WebRTC. Not done: a self-trained model (GĐ2), ROI and counting line (placeholders until birds are seen on a clip, plan §19.7), the VPS Dockerfile (§18.3), dataset tools (§7.2, §7.4).

## Commands

```bash
cd ai-pipeline                                         # every command runs from here (relative paths)
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
python src/stream.py                                   # source: CAMERA_RTSP_URL in .env
python src/stream.py --source clips/x.mp4 --session EVENING_ENTRY --no-mqtt   # also --realtime, --config
pytest                                                 # pytest.ini puts src/ on the path
powershell -ExecutionPolicy Bypass -File tools/record_session.ps1   # record clips (plan §7.1, §16.6)
```

MJPEG preview at `http://127.0.0.1:8090/stream` (`?boxes=0` = raw) for tuning ROI and the counting line. Python 3.11–3.12 (`onnxruntime` 1.30 needs ≥ 3.11; versions pinned in plan §4). CI runs `pytest` (`.github/workflows/ci.yml`, job `ai-pipeline`).

## Structure

```
config/config.yaml    camera, model, classes, tracking, sessions (UTC+7), MQTT, MJPEG, logging — no secrets
.env.example          template for .env (RTSP URL, MQTT, farm/house/device IDs)
requirements.txt      pinned per plan §4
pytest.ini
src/
  stream.py           latest-frame reader thread with back-off reconnect, session switching, drawing, MQTT, state.json
  inference.py        ONNX Runtime; decode() reads YOLO26n nms=False (1,300,6) and YOLOv8n/YOLO11n (1,4+nc,N) + NMS
  counting.py         LineCounter (sv.LineZone), current_session, BucketClock (5-minute buckets)
  mjpeg_server.py     dev preview on 127.0.0.1, encodes JPEG only while someone watches
  stream_pusher.py    pushes annotated frames to MediaMTX via ffmpeg in its own thread; back-off retry; masks the URL password in logs
tools/record_session.ps1  record RTSP clips named per plan §7.1
tests/                test_counting.py, test_inference.py, test_state.py — no camera, model or broker needed
```

Still to add (plan): `Dockerfile` + `config/config.vps.yaml` (§18.3), `tools/extract_frames.py` and `tools/split_by_day.py` (§7.2, §7.4). Not committed: `.env`, `models/`, `clips/`, `dataset/`, `logs/`, `state.json`.

Measured facts the code depends on (20/10/2026):
- Do not set ONNX Runtime `intra_op_num_threads` to `os.cpu_count()`: logical cores double inference time (45 ms vs 21 ms on a Ryzen 7 6800H). Leave the ORT default.
- `sv.ByteTrack` is deprecated since supervision 0.28 and removed in 0.31 — `requirements.txt` pins `<0.31`; upgrading means moving to Roboflow's `trackers` package.
- The camera stream is video only (H.264 1920×1080, 25 fps — `ffprobe`). `tools/record_session.ps1` still records with `-map 0:v:0 -an`, so turning the camera microphone on (G.711-type audio cannot go into mp4) does not stop recording.

## Rules

### Scope and parameters
- **[Bắt buộc]** One detection class, `swiftlet`. Nothing new for predators (rat/snake/owl), `PREDATOR_DETECTED` or `vision/alert`; code a PR touches that still refers to them is removed, not extended.
- **[Bắt buộc]** Class map, confidence/NMS thresholds, ROI, counting line and direction, session windows, publish intervals and model path come from `config/config.yaml` — no magic numbers in `src/`. A new tunable goes into the config with a comment.
- **[Bắt buộc]** No threshold or behaviour invented without a source (SRS, plan, Domain Expert, a measured result). A value picked by hand is labelled as such in the config comment and, if it reaches users or the backend, listed with the unconfirmed assumptions at the end of SRS §0.5.
- **[Bắt buộc]** Runtime targets the plan's stack: `onnxruntime` + `supervision` (ByteTrack, `LineZone`) — no `torch`/`ultralytics` in `requirements.txt` (they are for training on Colab only). New dependencies are pinned with a lower bound like the existing ones.

### Secrets, data and models
- **[Bắt buộc]** Camera RTSP URL (it carries the camera password), MQTT credentials, `STREAM_PUSH_URL` and the farm/house/device IDs come from `.env` (`CAMERA_RTSP_URL`, `MQTT_USERNAME`/`MQTT_PASSWORD`, `STREAM_PUSH_URL`, `CAMERA_DEVICE_ID`, `FARM_ID`, `HOUSE_ID`), never from `config.yaml` or code. A new variable is added to an `.env.example` with a placeholder.
- **[Bắt buộc]** Never commit model weights (`*.onnx`, `*.pt`), clips, frames, datasets, `.env`, logs or `state.json`; extend `.gitignore` when a new artifact folder appears. Record which model version runs (`model.version` in the config, sent as `firmwareVersion` in the heartbeat).
- **[Bắt buộc]** Anything leaving the machine uses TLS in deploy mode (MQTT 8883, `rtsps://` push). The MJPEG preview binds to `127.0.0.1` only; remote viewers go through MediaMTX with backend-checked access.

### MQTT contract with the backend
- **[Bắt buộc]** Topics are per **house** (backend SRS v2.1.8: the camera watches the entrance of the whole swiftlet house, so cameras and bird counts belong to the House, not a Zone): `swiftletcare/{farmId}/{houseId}/vision/bird-count`, `swiftletcare/{farmId}/{houseId}/heartbeat`, `swiftletcare/{farmId}/{houseId}/vision/alert` (what `backend/src/mqtt/mqtt.client.ts` subscribes to; built by `stream.py#topic_base`), using the real MongoDB ObjectIds.
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
| Backend side | `birdCount.handler.ts` only logs; CameraNode heartbeat not handled; `listCameraNodes` returns `rtsp_url` | Plan §8 (backend PR, judged by `backend/CLAUDE.md`) |

A PR that touches a file in this table **should** pay the debt; it **must** when it makes the debt worse (e.g. adding a predator class or a secret to `config.yaml`).

## Before opening a PR

- **[Bắt buộc]** `pytest tests/` passes (once tests exist); the pipeline runs on at least one clip with `--no-mqtt` and the PR states the resulting counts.
- **[Bắt buộc]** For a payload or topic change: checked against `backend/src/mqtt/mqtt.client.ts`, `BirdCountPayload` and `docs/api/api-spec.yaml`, and tested end-to-end against a local EMQX + backend when the backend handler exists.
- **[Bắt buộc]** For a model, threshold or counting change: before/after numbers on the same clips, following the accuracy rule above.
- **[Bắt buộc]** No weights, clips, datasets or `.env` in the diff.
- **[Bắt buộc]** PR fills `.github/pull_request_template.md`; commits follow `.commitlintrc.json` (scope `vision`; `rpi` is a leftover from the Raspberry Pi design).
