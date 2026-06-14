"""Lightweight background job manager shared by every Simpester module.

Each tool runs on its own daemon thread and reports back through a Job object:
append-only log lines and a free-form stats dict. The Flask layer polls
`Job.snapshot()` so the Stitch UI can render live progress.
"""

import threading
import time
import traceback
import uuid


class Job:
    def __init__(self, job_id, kind, label):
        self.id = job_id
        self.kind = kind
        self.label = label
        self.status = "running"  # running | done | error | stopped
        self.created = time.time()
        self.finished = None
        self.error = None
        self.log = []
        self.stats = {}
        self.thread = None
        self._stop = threading.Event()
        self._stopper = None  # optional callable to ask the underlying tool to stop
        self._lock = threading.Lock()

    # -- reporting helpers (called from the worker thread) -----------------
    def add_log(self, message, level="info"):
        with self._lock:
            self.log.append({"t": time.time(), "level": level, "msg": str(message)})
            if len(self.log) > 3000:
                self.log = self.log[-3000:]

    def set_stats(self, **kwargs):
        with self._lock:
            self.stats.update(kwargs)

    def bind_stopper(self, fn):
        self._stopper = fn

    # -- control -----------------------------------------------------------
    def request_stop(self):
        self._stop.set()
        if self._stopper:
            try:
                self._stopper()
            except Exception:
                pass

    @property
    def stop_requested(self):
        return self._stop.is_set()

    # -- read --------------------------------------------------------------
    def snapshot(self, tail=300):
        with self._lock:
            return {
                "id": self.id,
                "kind": self.kind,
                "label": self.label,
                "status": self.status,
                "error": self.error,
                "stats": dict(self.stats),
                "log": self.log[-tail:] if tail else list(self.log),
                "created": self.created,
                "finished": self.finished,
            }


class JobManager:
    def __init__(self):
        self.jobs = {}
        self._lock = threading.Lock()

    def create(self, kind, label):
        jid = uuid.uuid4().hex[:12]
        job = Job(jid, kind, label)
        with self._lock:
            self.jobs[jid] = job
        return job

    def get(self, jid):
        with self._lock:
            return self.jobs.get(jid)

    def list(self):
        with self._lock:
            ordered = sorted(self.jobs.values(), key=lambda j: j.created, reverse=True)
        return [j.snapshot(tail=1) for j in ordered]

    def overview(self, modules):
        with self._lock:
            all_jobs = list(self.jobs.values())
        running = sum(1 for j in all_jobs if j.status == "running")
        done = sum(1 for j in all_jobs if j.status == "done")
        errors = sum(1 for j in all_jobs if j.status == "error")
        files = 0
        for j in all_jobs:
            for key in ("files", "downloaded", "images_downloaded"):
                v = j.stats.get(key)
                if isinstance(v, (int, float)):
                    files += int(v)
                    break
        recent = sorted(all_jobs, key=lambda j: j.created, reverse=True)[:8]
        return {
            "modules": len(modules),
            "running": running,
            "done": done,
            "errors": errors,
            "files": files,
            "recent": [j.snapshot(tail=1) for j in recent],
        }

    def run(self, job, target):
        """Run `target(job)` on a daemon thread with status + error handling."""
        def _wrap():
            try:
                target(job)
                if job.status == "running":
                    job.status = "stopped" if job.stop_requested else "done"
            except Exception as exc:  # noqa: BLE001 - surface everything to the UI
                job.status = "error"
                job.error = str(exc)
                job.add_log(str(exc), "error")
                job.add_log(traceback.format_exc(), "error")
            finally:
                job.finished = time.time()

        t = threading.Thread(target=_wrap, daemon=True)
        job.thread = t
        t.start()
        return job
