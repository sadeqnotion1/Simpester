# Simpester — Elite Control

A single launcher that **combines your separate tools into one app**. It's a
Flask + pywebview desktop control center (the same proven pattern as MusicMV):
a local web server renders the Stitch UI, wrapped in a native window.

This release wires two of your tools end-to-end:

- **Fetch Wallpaper** — the scraper at the repo root (`main.py` / `src/`).
- **Pornripsto** — the bulk downloader from `Pornripsto/`.

More tools (MusicMV, Colab-to-Tel, TikTok-Metadata-Archiver) can be added with
the same two-step pattern described below.

---

## How it's structured (overlay on the Simpester repo root)

```
main.py                         # NEW entry point: launches the GUI by default; --cli runs old scraper
app.py                          # Flask + pywebview control center
control_center/
    jobs.py                     # background job runner (threads, live log + stats)
    modules/
        wallpaper_module.py     # drives the existing src/scraper.WallpaperScraper
        pornrips_module.py      # callback-driven port of Pornripsto/pornrips_bulk_downloader.py
templates/                      # Stitch-styled HTML (overview, wallpaper, pornrips, settings)
static/css/app.css
static/js/app.js
requirements.txt                # combined deps (Flask, pywebview, + Fetch Wallpaper deps)
run_simpester.bat               # double-click launcher

# your existing files stay exactly as they are:
src/  configs/  Pornripsto/  ...
```

Your original tool code is **not modified** — the control center imports and
drives it. `main.py` is replaced with a smart launcher that opens the GUI by
default and still supports the old CLI via `--cli`.

---

## Run it

```bat
run_simpester.bat
```

or manually:

```bat
python -m pip install -r requirements.txt
python main.py
```

- Default: opens the **Elite Control** window (falls back to your browser if no
  webview runtime is installed).
- `python main.py --no-window` — server only, opens in your browser.
- `python main.py --cli --site margaretqualley` — the original Fetch Wallpaper CLI.

---

## Put it into your repo

This ZIP contains files meant to sit at the **root** of the Simpester repo
(alongside `src/`, `configs/`, `Pornripsto/`). From your local clone:

```bash
# 1. unzip the contents into the repo root (let it overwrite main.py & requirements.txt)
#    e.g. copy everything from the zip into G:\SimpCounty\Fetch-WP\simpester

# 2. review the changes
git status
git add main.py app.py control_center templates static requirements.txt run_simpester.bat SIMPESTER_CONTROL_CENTER.md
git commit -m "Add Elite Control: unified Flask+pywebview shell combining Fetch Wallpaper + Pornripsto"
git push origin master
```

> I can't push to GitHub or merge repos for you from here — so the steps above
> are how you land it. If you'd rather keep the other tools as their own repos,
> use `git subtree add` / submodules per tool and add a matching module adapter.

---

## Add another tool (2 steps)

1. **Adapter** — `control_center/modules/yourtool_module.py`:

   ```python
   def run_yourtool(job, params):
       job.add_log("starting…")
       # ... do work, calling job.add_log(...) and job.set_stats(key=value)
       # check job.stop_requested periodically to support the Stop button
   ```

2. **Register** — add an entry to `MODULES` in `app.py`, a `/api/yourtool/start`
   route, and a `templates/yourtool.html` page (copy `pornrips.html`).

That's it — live logs, progress stats, and Start/Stop come for free from the
job runner.

---

## Notes & honest limitations

- I built and syntax-checked this locally, but I can't run a GUI or install pip
  packages in my sandbox, so I couldn't do a live render test — first run on your
  machine will confirm the webview.
- Pornripsto's torrent→magnet conversion is a best-effort bencode hash; if a post
  already exposes a magnet link, that's used directly.
- Networked scraping obviously requires internet on your machine.
