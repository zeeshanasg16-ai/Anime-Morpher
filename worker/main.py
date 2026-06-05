"""AnimeMorph GPU worker — pull-based poll loop.

Run: `python main.py`. The worker repeatedly claims a job from the Render app,
downloads the input via a presigned URL, converts it (ffmpeg + ComfyUI), uploads
the result via a presigned URL, and reports progress/completion/failure. It can
be stopped at any time; an in-flight job is auto-reclaimed by the server's
stale-job timer and picked up again on restart.
"""

import os
import shutil
import time

import api_client
import config
import media
import stylize


def _reset_workdir() -> str:
    work = config.WORK_DIR
    if os.path.exists(work):
        shutil.rmtree(work, ignore_errors=True)
    os.makedirs(work, exist_ok=True)
    return work


def _process_video(api: api_client.ApiClient, claim: dict, work: str) -> tuple[str, float]:
    job = claim["job"]
    job_id = job["id"]
    style = job.get("style") or "anime"

    input_path = os.path.join(work, "input")
    api.download(claim["input"]["downloadURL"], input_path)

    info = media.probe_video(input_path)
    fps = min(info["fps"], config.MAX_FPS)

    frames_dir = os.path.join(work, "frames")
    out_frames_dir = os.path.join(work, "out_frames")
    os.makedirs(out_frames_dir, exist_ok=True)

    total = media.extract_frames(input_path, frames_dir, fps)
    if total == 0:
        raise RuntimeError("No frames could be extracted from the input video")

    audio_path = os.path.join(work, "audio.aac")
    has_audio = media.extract_audio(input_path, audio_path)

    api.progress(job_id, 10)
    frames = sorted(n for n in os.listdir(frames_dir) if n.endswith(".png"))
    last_reported = 10
    for idx, name in enumerate(frames):
        stylize.stylize_image(
            os.path.join(frames_dir, name),
            os.path.join(out_frames_dir, name),
            style,
        )
        # Map frame progress into the 10..90 band reserved for stylization.
        pct = 10 + int((idx + 1) / total * 80)
        if pct >= last_reported + 2:
            api.progress(job_id, pct)
            last_reported = pct

    api.progress(job_id, 92)
    out_path = os.path.join(work, "output.mp4")
    media.reassemble(
        out_frames_dir,
        out_path,
        fps,
        audio_path if has_audio else None,
    )

    api.progress(job_id, 96)
    api.upload(claim["output"]["uploadURL"], out_path, claim["output"]["contentType"])
    return claim["output"]["objectPath"], info["duration"]


def _process_photo(api: api_client.ApiClient, claim: dict, work: str) -> tuple[str, float]:
    job = claim["job"]
    job_id = job["id"]
    style = job.get("style") or "anime"

    input_path = os.path.join(work, "input")
    api.download(claim["input"]["downloadURL"], input_path)

    api.progress(job_id, 20)
    out_path = os.path.join(work, "output.png")
    stylize.stylize_image(input_path, out_path, style)

    api.progress(job_id, 90)
    api.upload(claim["output"]["uploadURL"], out_path, claim["output"]["contentType"])
    return claim["output"]["objectPath"], 0.0


def _handle(api: api_client.ApiClient, claim: dict) -> None:
    job = claim["job"]
    job_id = job["id"]
    work = _reset_workdir()
    try:
        if job["type"] == "video_morph":
            output_path, duration = _process_video(api, claim, work)
            api.complete(job_id, output_path, duration if duration else None)
        else:
            output_path, _ = _process_photo(api, claim, work)
            api.complete(job_id, output_path)
        print(f"[worker] job {job_id} complete -> {output_path}", flush=True)
    except Exception as exc:  # noqa: BLE001 — report any failure to the server
        print(f"[worker] job {job_id} failed: {exc}", flush=True)
        api.fail(job_id, str(exc))
    finally:
        shutil.rmtree(work, ignore_errors=True)


def main() -> None:
    api = api_client.ApiClient()
    print(
        f"[worker] {config.WORKER_ID} polling {config.API_BASE_URL} "
        f"every {config.POLL_INTERVAL}s",
        flush=True,
    )
    while True:
        try:
            claim = api.claim()
        except Exception as exc:  # noqa: BLE001 — never let a transient error kill the loop
            print(f"[worker] claim error: {exc}", flush=True)
            time.sleep(config.POLL_INTERVAL)
            continue

        if claim is None:
            time.sleep(config.POLL_INTERVAL)
            continue

        print(f"[worker] claimed job {claim['job']['id']} ({claim['job']['type']})", flush=True)
        _handle(api, claim)


if __name__ == "__main__":
    main()
