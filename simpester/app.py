#!/usr/bin/env python3
"""
Simpester — Elite Control.

A Flask + pywebview control center that hosts each Simpester tool as a module.
Mirrors the proven MusicMV pattern: a local Flask server rendering the Stitch
HTML UI, wrapped in a native desktop window via pywebview (falls back to the
system browser if pywebview / a webview runtime is unavailable).
"""

import os
import socket
import sys
import threading
import time
import webbrowser

from flask import Flask, jsonify, render_template, request

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from control_center.jobs import JobManager
from control_center.modules import pornrips_module, wallpaper_module

app = Flask(__name__, template_folder="templates", static_folder="static")
app.config["JSON_SORT_KEYS"] = False
# Use [[ ... ]] for Jinja variable interpolation (avoids clashing with other
# brace-based templating in the toolchain). Control tags stay as {% ... %}.
app.jinja_env.variable_start_string = "[["
app.jinja_env.variable_end_string = "]]"
jobs = JobManager()

# Registry of tools surfaced in the UI. Add a dict here to expose a new module.
MODULES = [
    {
        "id": "wallpaper",
        "name": "Fetch Wallpaper",
        "icon": "wallpaper",
        "tag": "Scraper",
        "desc": "Crawl a site and download high-resolution images, filtered by size and format.",
        "route": "/wallpaper",
    },
    {
        "id": "pornrips",
        "name": "Pornripsto",
        "icon": "movie",
        "tag": "Bulk Downloader",
        "desc": "Resolve 1080p posts for a date, then fetch torrents, magnets and screenshots in parallel.",
        "route": "/pornrips",
    },
]


def _ctx(active):
    return {"modules": MODULES, "active": active}


@app.route("/")
def overview():
    return render_template("overview.html", **_ctx("overview"))


@app.route("/wallpaper")
def wallpaper_page():
    return render_template("wallpaper.html", **_ctx("wallpaper"))


@app.route("/pornrips")
def pornrips_page():
    return render_template("pornrips.html", **_ctx("pornrips"))


@app.route("/settings")
def settings_page():
    return render_template("settings.html", **_ctx("settings"))


# ----------------------------- API ---------------------------------------

@app.post("/api/wallpaper/start")
def api_wallpaper_start():
    params = request.get_json(silent=True) or {}
    site = params.get("site") or "margaretqualley"
    job = jobs.create("wallpaper", f"Fetch Wallpaper · {site}")
    jobs.run(job, lambda j: wallpaper_module.run_wallpaper(j, params))
    return jsonify({"job_id": job.id})


@app.post("/api/pornrips/start")
def api_pornrips_start():
    params = request.get_json(silent=True) or {}
    date = params.get("date") or ""
    job = jobs.create("pornrips", f"Pornripsto · {date or 'today'}")
    jobs.run(job, lambda j: pornrips_module.run_pornrips(j, params))
    return jsonify({"job_id": job.id})


@app.post("/api/jobs/<jid>/stop")
def api_job_stop(jid):
    job = jobs.get(jid)
    if not job:
        return jsonify({"ok": False, "notfound": True}), 404
    job.request_stop()
    job.add_log("Stop requested by user…", "warn")
    return jsonify({"ok": True})


@app.get("/api/jobs/<jid>")
def api_job(jid):
    job = jobs.get(jid)
    if not job:
        return jsonify({"notfound": True}), 404
    tail = request.args.get("tail", default=300, type=int)
    return jsonify(job.snapshot(tail=tail))


@app.get("/api/jobs")
def api_jobs():
    return jsonify({"jobs": jobs.list()})


@app.get("/api/state")
def api_state():
    return jsonify(jobs.overview(MODULES))


# --------------------------- launcher -------------------------------------

def _find_free_port(preferred=30309):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.bind(("127.0.0.1", preferred))
        s.close()
        return preferred
    except OSError:
        s.close()
        s2 = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s2.bind(("127.0.0.1", 0))
        port = s2.getsockname()[1]
        s2.close()
        return port


def _run_server(port):
    # Prefer waitress (production-grade, quiet) if available; else Flask dev server.
    try:
        from waitress import serve
        serve(app, host="127.0.0.1", port=port, threads=8, _quiet=True)
    except Exception:
        app.run(host="127.0.0.1", port=port, threaded=True, use_reloader=False)


def launch(open_window=True, forced_port=None):
    port = forced_port or _find_free_port()
    url = f"http://127.0.0.1:{port}"

    server = threading.Thread(target=_run_server, args=(port,), daemon=True)
    server.start()
    time.sleep(0.6)

    print("=" * 60)
    print("  Simpester — Elite Control")
    print(f"  Serving at: {url}")
    print("=" * 60)

    if open_window:
        try:
            import webview
            webview.create_window(
                title="Simpester — Elite Control",
                url=url,
                width=1320,
                height=880,
                min_size=(1040, 700),
                background_color="#05060a",
            )
            webview.start()
            return
        except Exception as e:
            print(f"[INFO] pywebview unavailable ({e}). Falling back to your browser.")

    webbrowser.open(url)
    print("[STATUS] Press Ctrl+C in this terminal to exit.")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nShutting down…")


if __name__ == "__main__":
    launch()
