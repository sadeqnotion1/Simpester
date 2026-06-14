// Simpester Elite Control — shared frontend helpers.
const Simp = {
  async post(url, body) {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    return r.json();
  },
  async get(url) {
    const r = await fetch(url);
    return r.json();
  },
  escape(s) {
    return (s == null ? "" : String(s)).replace(
      /[&<>]/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c],
    );
  },
  fmtTime(t) {
    try {
      return new Date(t * 1000).toLocaleTimeString();
    } catch (e) {
      return "";
    }
  },
  renderLog(el, log) {
    if (!el) return;
    el.innerHTML = (log || [])
      .map(
        (l) =>
          `<div class="log-line log-${l.level || "info"}"><span style="opacity:.4">${Simp.fmtTime(l.t)}</span> ${Simp.escape(l.msg)}</div>`,
      )
      .join("");
    el.scrollTop = el.scrollHeight;
  },
  badge(status) {
    return `<span class="badge badge-${status}">${status}</span>`;
  },
};

// Poll a job until it leaves the "running" state.
function trackJob(jobId, { onUpdate } = {}) {
  const timer = setInterval(async () => {
    let snap;
    try {
      snap = await Simp.get(`/api/jobs/${jobId}`);
    } catch (e) {
      return;
    }
    if (snap && snap.notfound) {
      clearInterval(timer);
      return;
    }
    if (onUpdate) onUpdate(snap);
    if (snap.status !== "running") clearInterval(timer);
  }, 900);
  return timer;
}

// Update the header job counter globally.
async function refreshGlobalCount() {
  try {
    const s = await Simp.get("/api/state");
    const el = document.getElementById("global-jobcount");
    if (el) el.textContent = `${s.running} running · ${s.files} files`;
  } catch (e) {}
}
setInterval(refreshGlobalCount, 2000);
document.addEventListener("DOMContentLoaded", refreshGlobalCount);
