"""Runtime configuration loaded from environment variables.

A tiny .env loader is included so the worker runs the same way on a GPU
marketplace box (where you usually just `export` vars or drop a .env file) as it
does locally, without pulling in extra dependencies.
"""

import os
import socket


def _load_dotenv(path: str = ".env") -> None:
    if not os.path.exists(path):
        return
    with open(path, "r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            # Real environment always wins over the file.
            os.environ.setdefault(key, value)


_load_dotenv()


def _require(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise SystemExit(f"Missing required env var: {name}")
    return value


API_BASE_URL = _require("API_BASE_URL").rstrip("/")
WORKER_TOKEN = _require("WORKER_TOKEN")
WORKER_ID = os.environ.get("WORKER_ID", "").strip() or socket.gethostname()

POLL_INTERVAL = float(os.environ.get("POLL_INTERVAL", "5"))
WORK_DIR = os.environ.get("WORK_DIR", "/tmp/animemorph")

COMFYUI_URL = os.environ.get("COMFYUI_URL", "http://127.0.0.1:8188").rstrip("/")
COMFYUI_CKPT = os.environ.get("COMFYUI_CKPT", "").strip()
COMFYUI_DENOISE = float(os.environ.get("COMFYUI_DENOISE", "0.55"))

MAX_FPS = float(os.environ.get("MAX_FPS", "15"))

# Per-style positive prompt fed to the img2img workflow. Tune freely.
STYLE_PROMPTS = {
    "anime": "anime style, cel shading, clean line art, vibrant colors, studio anime key visual",
    "cartoon": "western cartoon style, bold outlines, flat shading, playful, comic illustration",
    "ghibli": "studio ghibli style, soft painterly background, gentle colors, hand-drawn animation",
    "cyberpunk": "cyberpunk anime style, neon lights, futuristic, high contrast, dramatic lighting",
    "watercolor": "watercolor painting style, soft washes, paper texture, delicate brush strokes",
}
NEGATIVE_PROMPT = "lowres, bad anatomy, blurry, jpeg artifacts, watermark, text"
