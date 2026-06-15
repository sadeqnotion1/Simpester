(function () {
  const defaultLabel = "📋 Copy post links";

  function collectLinks() {
    const set = new Set();

    // 1) Standard WordPress post-title / bookmark links (most reliable).
    document
      .querySelectorAll(
        '.entry-title a, h1 a[rel="bookmark"], h2 a[rel="bookmark"], article a[rel="bookmark"]'
      )
      .forEach((a) => { if (a.href) set.add(a.href.split("#")[0]); });

    // 2) Fallback: links that look like a single-slug post permalink.
    if (set.size === 0) {
      const bad = /\/(page|category|tag|author|wp-login|wp-admin)\b|[?]|\/\d{4}\/\d{2}\/\d{2}\/?$/i;
      document.querySelectorAll("a[href]").forEach((a) => {
        try {
          const u = new URL(a.href, location.href);
          if (!u.hostname.endsWith("pornrips.to")) return;
          const segs = u.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
          if (segs.length === 1 && !bad.test(u.pathname + u.search)) {
            set.add(u.origin + u.pathname);
          }
        } catch (e) {}
      });
    }
    return [...set];
  }

  async function copyLinks() {
    const links = collectLinks();
    const text = links.join("\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    btn.textContent = "Copied " + links.length + " links ✓";
    setTimeout(() => (btn.textContent = defaultLabel), 2500);
  }

  const btn = document.createElement("button");
  btn.textContent = defaultLabel;
  btn.style.cssText =
    "position:fixed;bottom:20px;right:20px;z-index:999999;padding:10px 16px;" +
    "background:#e0245e;color:#fff;border:none;border-radius:8px;font-size:14px;" +
    "cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.4);font-family:sans-serif;";
  btn.addEventListener("click", copyLinks);

  const mount = () => document.body && document.body.appendChild(btn);
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);
})();
