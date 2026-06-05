# AnimeMorph GPU Worker

This is the heavy-lifting half of AnimeMorph. The Render app (frontend + API +
job queue + R2 storage) is the **control plane**; this worker is the **GPU
plane**. It runs on a cheap rented GPU (Vast.ai / Clore.ai), pulls jobs from the
app, does the real video→anime conversion, and reports results back.

## How it works (pull model)

The worker never needs a public URL. It only makes **outbound** calls to the app:

1. `POST /api/worker/claim` — atomically claim the next queued job. The response
   includes the job plus a short-lived presigned **download** URL (the input) and
   a presigned **upload** URL (where to put the output). The worker holds no R2
   credentials.
2. Download input → split into frames + audio (`ffmpeg`) → stylize each frame
   (ComfyUI) → reassemble with the original audio → upload the result.
3. `POST /api/worker/jobs/:id/progress` periodically, then
   `POST /api/worker/jobs/:id/complete` (or `/fail`).

If the worker dies mid-job, the app's stale-job timer (`WORKER_STALE_MINUTES`,
default 30) returns the job to the queue so another worker — or this one on
restart — picks it up. You can run zero, one, or many workers; jobs simply wait
in the queue while none are online.

## Connecting it to the Render app

Two things must share **one** secret:

1. On Render, set `WORKER_TOKEN` to a long random string (Render dashboard →
   the `anime-morph-api` service → Environment). It is already declared in
   `render.yaml`.
2. On the worker, set the **same** value plus the app URL (see below).

That's the entire connection — no inbound networking, no firewall rules.

## Worker setup (Vast.ai / Clore.ai)

1. **Rent a GPU instance** using a **ComfyUI** or **PyTorch + CUDA** template
   (both Vast.ai and Clore.ai have one-click ComfyUI templates). A 12–16 GB card
   (RTX 3060/4070 class) is plenty for SD1.5 img2img.
2. **Start ComfyUI** on the box (most templates auto-start it on port `8188`) and
   put a checkpoint in `ComfyUI/models/checkpoints/` — an anime model such as
   *Anything v5* or *Counterfeit* works well. Note the exact filename.
3. **Get this `worker/` folder onto the box** (git clone the repo, or scp just
   this folder).
4. **Install deps** (ffmpeg is usually already present on these templates):
   ```bash
   apt-get update && apt-get install -y ffmpeg python3-pip   # if missing
   pip install -r requirements.txt
   ```
5. **Configure** — copy `.env.example` to `.env` and fill it in:
   ```bash
   cp .env.example .env
   # API_BASE_URL = https://anime-morpher.onrender.com/api
   # WORKER_TOKEN = <same string you set on Render>
   # COMFYUI_URL  = http://127.0.0.1:8188
   # COMFYUI_CKPT = <your checkpoint filename>
   ```
6. **Run it:**
   ```bash
   python3 main.py
   ```
   Submit a job in the web app; the worker logs `claimed job …` and the progress
   bar in the UI advances with real progress.

## Tuning

- **`COMFYUI_DENOISE`** (0.45–0.65): lower stays closer to the source video and
  flickers less frame-to-frame; higher stylizes harder.
- **`MAX_FPS`** (default 15): caps how many frames a long clip produces. A 10-min
  clip at 24fps is ~14k frames; dropping to 12–15fps roughly halves the GPU time
  while keeping motion smooth.
- **Per-style prompts** live in `config.py` (`STYLE_PROMPTS`); edit them to taste.

## Faster / cheaper alternative for long clips

img2img is the highest quality but the slowest path. For long 10-minute videos,
swap `stylize.py` for an **AnimeGANv3 / AnimeGAN2** pass — a tiny feed-forward
network that stylizes a frame in milliseconds, needs no prompt, and is trivial to
run headless. Keep the same `stylize_image(in_path, out_path, style)` signature.
Trade-off: a fixed look (no per-style prompts) and slightly less detail. See the
header of `stylize.py` for details.

## Cost control

- Rent **by the hour** and **shut the instance down** when you're not converting
  — that's the entire bill. The Render app keeps running for free and just holds
  jobs in the queue until you bring a worker back up.
- Keep test clips short while dialing in settings; only run full 10-min clips
  once you're happy with the look.

## Files

| File | Role |
| --- | --- |
| `main.py` | Poll loop + per-job orchestration |
| `api_client.py` | Authenticated calls to the app + presigned blob transfer |
| `media.py` | ffmpeg/ffprobe: frames ⇄ video, audio extract/mux |
| `stylize.py` | Pluggable stylization (ComfyUI img2img by default) |
| `config.py` | Env-driven configuration + per-style prompts |
| `workflows/img2img.json` | ComfyUI API-format workflow template |
