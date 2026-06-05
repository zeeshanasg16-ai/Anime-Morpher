"""ffmpeg/ffprobe helpers for splitting a video into frames + audio and
reassembling the stylized frames back into a video with the original audio.

Requires `ffmpeg` and `ffprobe` to be installed and on PATH (every ComfyUI /
PyTorch GPU template ships them, or `apt-get install -y ffmpeg`).
"""

import json
import os
import subprocess
from typing import Optional


def _run(cmd: list[str]) -> str:
    result = subprocess.run(
        cmd, check=True, capture_output=True, text=True
    )
    return result.stdout


def probe_video(path: str) -> dict:
    """Return {'fps': float, 'duration': float, 'has_audio': bool}."""
    out = _run(
        [
            "ffprobe",
            "-v",
            "error",
            "-print_format",
            "json",
            "-show_streams",
            "-show_format",
            path,
        ]
    )
    data = json.loads(out)
    fps = 24.0
    has_audio = False
    for stream in data.get("streams", []):
        if stream.get("codec_type") == "audio":
            has_audio = True
        if stream.get("codec_type") == "video":
            rate = stream.get("avg_frame_rate") or stream.get("r_frame_rate") or "24/1"
            num, _, den = rate.partition("/")
            try:
                d = float(den) if den else 1.0
                fps = float(num) / d if d else 24.0
            except (ValueError, ZeroDivisionError):
                fps = 24.0
    duration = float(data.get("format", {}).get("duration", 0.0) or 0.0)
    return {"fps": fps or 24.0, "duration": duration, "has_audio": has_audio}


def extract_frames(input_path: str, frames_dir: str, fps: float) -> int:
    """Sample the video to PNG frames at `fps`. Returns the frame count."""
    os.makedirs(frames_dir, exist_ok=True)
    _run(
        [
            "ffmpeg",
            "-y",
            "-i",
            input_path,
            "-vf",
            f"fps={fps}",
            os.path.join(frames_dir, "frame_%06d.png"),
        ]
    )
    return len([n for n in os.listdir(frames_dir) if n.endswith(".png")])


def extract_audio(input_path: str, audio_path: str) -> bool:
    """Extract the audio track to AAC. Returns False if there is no audio."""
    try:
        _run(
            [
                "ffmpeg",
                "-y",
                "-i",
                input_path,
                "-vn",
                "-acodec",
                "aac",
                audio_path,
            ]
        )
        return os.path.exists(audio_path) and os.path.getsize(audio_path) > 0
    except subprocess.CalledProcessError:
        return False


def reassemble(
    frames_dir: str,
    out_path: str,
    fps: float,
    audio_path: Optional[str] = None,
) -> None:
    """Encode stylized frames (frame_%06d.png) into an mp4, muxing the original
    audio back in when present."""
    cmd = [
        "ffmpeg",
        "-y",
        "-framerate",
        str(fps),
        "-i",
        os.path.join(frames_dir, "frame_%06d.png"),
    ]
    if audio_path and os.path.exists(audio_path):
        cmd += ["-i", audio_path]
    cmd += [
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-crf",
        "20",
    ]
    if audio_path and os.path.exists(audio_path):
        cmd += ["-c:a", "aac", "-shortest"]
    cmd.append(out_path)
    _run(cmd)
