"""HTTP client for the worker control-plane on the Render app.

All calls are authenticated with the shared `x-worker-token` header. The worker
holds NO R2 credentials — it only ever uses the short-lived presigned URLs the
API returns from /worker/claim.
"""

from typing import Optional

import requests

import config


class ApiClient:
    def __init__(self) -> None:
        self.base = config.API_BASE_URL
        self.worker_id = config.WORKER_ID
        self._session = requests.Session()
        self._session.headers.update({"x-worker-token": config.WORKER_TOKEN})

    # --- control plane ---

    def claim(self) -> Optional[dict]:
        """Claim the next job. Returns the claim payload, or None if the queue
        is empty (HTTP 204)."""
        resp = self._session.post(
            f"{self.base}/worker/claim",
            json={"workerId": self.worker_id},
            timeout=30,
        )
        if resp.status_code == 204:
            return None
        resp.raise_for_status()
        return resp.json()

    def progress(self, job_id: int, progress: int) -> None:
        # raise_for_status so a 409 (job reclaimed / no longer ours) aborts the
        # current run promptly instead of burning GPU on work nobody will accept.
        resp = self._session.post(
            f"{self.base}/worker/jobs/{job_id}/progress",
            json={"workerId": self.worker_id, "progress": int(progress)},
            timeout=30,
        )
        resp.raise_for_status()

    def complete(
        self,
        job_id: int,
        output_object_path: str,
        duration_seconds: Optional[float] = None,
    ) -> None:
        body: dict = {
            "workerId": self.worker_id,
            "outputObjectPath": output_object_path,
        }
        if duration_seconds is not None:
            body["durationSeconds"] = duration_seconds
        resp = self._session.post(
            f"{self.base}/worker/jobs/{job_id}/complete", json=body, timeout=60
        )
        resp.raise_for_status()

    def fail(self, job_id: int, error_message: str) -> None:
        try:
            self._session.post(
                f"{self.base}/worker/jobs/{job_id}/fail",
                json={"workerId": self.worker_id, "errorMessage": error_message[:2000]},
                timeout=30,
            )
        except requests.RequestException:
            # Failing to report a failure must never crash the poll loop; the
            # stale-reclaim timer on the server will recover the job anyway.
            pass

    # --- blob transfer via presigned URLs ---

    @staticmethod
    def download(url: str, dest_path: str) -> None:
        with requests.get(url, stream=True, timeout=600) as resp:
            resp.raise_for_status()
            with open(dest_path, "wb") as fh:
                for chunk in resp.iter_content(chunk_size=1024 * 1024):
                    if chunk:
                        fh.write(chunk)

    @staticmethod
    def upload(url: str, src_path: str, content_type: str) -> None:
        with open(src_path, "rb") as fh:
            resp = requests.put(
                url,
                data=fh,
                headers={"Content-Type": content_type},
                timeout=1800,
            )
        resp.raise_for_status()
