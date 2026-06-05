"""Pluggable stylization backend.

The default implementation drives a ComfyUI server over its HTTP API using an
img2img workflow (see workflows/img2img.json). The conversion step is isolated
behind `stylize_image(...)` so you can swap in a different engine without
touching the poll loop or the media pipeline.

--- Lighter / faster alternative for long 10-minute clips ---
img2img through a full SD checkpoint is the highest-quality option but also the
slowest (each 10-min clip is thousands of frames). If you want something much
faster and cheaper, swap this module for an AnimeGANv3 / AnimeGAN2 pass: it is a
single small feed-forward network that stylizes a frame in milliseconds on a
modest GPU, needs no prompt, and is far easier to run headless. The trade-off is
a fixed look (no per-style prompt control) and slightly less detail. To use it,
keep the same `stylize_image(in_path, out_path, style)` signature and call the
AnimeGAN model in place of the ComfyUI calls below.
"""

import copy
import json
import os
import random
import time
import uuid

import requests

import config

_WORKFLOW_PATH = os.path.join(os.path.dirname(__file__), "workflows", "img2img.json")

with open(_WORKFLOW_PATH, "r", encoding="utf-8") as _fh:
    _BASE_WORKFLOW = json.load(_fh)


def _upload_image(path: str) -> str:
    """Upload a frame into ComfyUI's input folder; returns its stored name."""
    with open(path, "rb") as fh:
        files = {"image": (os.path.basename(path), fh, "image/png")}
        resp = requests.post(
            f"{config.COMFYUI_URL}/upload/image",
            files=files,
            data={"overwrite": "true"},
            timeout=120,
        )
    resp.raise_for_status()
    data = resp.json()
    name = data.get("name")
    subfolder = data.get("subfolder") or ""
    return f"{subfolder}/{name}" if subfolder else name


def _build_prompt(image_name: str, style: str) -> dict:
    if not config.COMFYUI_CKPT:
        raise RuntimeError(
            "COMFYUI_CKPT is not set — point it at a checkpoint in ComfyUI's "
            "models/checkpoints folder."
        )
    wf = copy.deepcopy(_BASE_WORKFLOW)
    positive = config.STYLE_PROMPTS.get(style, config.STYLE_PROMPTS["anime"])
    wf["1"]["inputs"]["ckpt_name"] = config.COMFYUI_CKPT
    wf["2"]["inputs"]["image"] = image_name
    wf["4"]["inputs"]["text"] = positive
    wf["5"]["inputs"]["text"] = config.NEGATIVE_PROMPT
    wf["6"]["inputs"]["denoise"] = config.COMFYUI_DENOISE
    wf["6"]["inputs"]["seed"] = random.randint(0, 2**31 - 1)
    return wf


def _submit(workflow: dict) -> str:
    client_id = str(uuid.uuid4())
    resp = requests.post(
        f"{config.COMFYUI_URL}/prompt",
        json={"prompt": workflow, "client_id": client_id},
        timeout=120,
    )
    resp.raise_for_status()
    return resp.json()["prompt_id"]


def _wait_for_output(prompt_id: str, timeout: float = 600.0) -> dict:
    deadline = time.time() + timeout
    while time.time() < deadline:
        resp = requests.get(
            f"{config.COMFYUI_URL}/history/{prompt_id}", timeout=30
        )
        resp.raise_for_status()
        history = resp.json()
        if prompt_id in history:
            return history[prompt_id]["outputs"]
        time.sleep(1.0)
    raise TimeoutError(f"ComfyUI did not finish prompt {prompt_id} in time")


def _download_result(outputs: dict, out_path: str) -> None:
    for node_output in outputs.values():
        for image in node_output.get("images", []):
            params = {
                "filename": image["filename"],
                "subfolder": image.get("subfolder", ""),
                "type": image.get("type", "output"),
            }
            resp = requests.get(
                f"{config.COMFYUI_URL}/view", params=params, timeout=120
            )
            resp.raise_for_status()
            with open(out_path, "wb") as fh:
                fh.write(resp.content)
            return
    raise RuntimeError("ComfyUI produced no output image")


def stylize_image(in_path: str, out_path: str, style: str) -> None:
    """Stylize a single image file. Blocks until the result is written."""
    image_name = _upload_image(in_path)
    workflow = _build_prompt(image_name, style)
    prompt_id = _submit(workflow)
    outputs = _wait_for_output(prompt_id)
    _download_result(outputs, out_path)
