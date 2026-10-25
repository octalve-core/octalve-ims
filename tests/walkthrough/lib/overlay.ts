import type { Page } from "@playwright/test";

/**
 * Video legibility (template section 7.4): a visible cursor, a click
 * ripple, and a caption bar drawn *inside* the page, so all three are in
 * the recording by construction — no ffmpeg needed for this part. Installed
 * via addInitScript so it survives the tab's one navigation automatically;
 * nothing here is an actor (it never calls the app, never clicks on the
 * app's behalf), so it stays out of the guard test's scope by living in
 * lib/, not steps/.
 */
const OVERLAY_SCRIPT = `
(() => {
  if (window.__walkthroughOverlayInstalled) return;
  window.__walkthroughOverlayInstalled = true;

  function boot() {
    const style = document.createElement("style");
    style.textContent = \`
      #__wt-caption-bar {
        position: fixed; left: 0; right: 0; bottom: 0; z-index: 2147483647;
        background: rgba(17, 24, 39, 0.92); color: #f9fafb;
        font: 15px/1.4 -apple-system, system-ui, sans-serif;
        padding: 10px 18px; min-height: 20px; pointer-events: none;
        border-top: 2px solid #60a5fa;
      }
      #__wt-cursor {
        position: fixed; top: 0; left: 0; width: 18px; height: 18px;
        border-radius: 50%; background: rgba(96, 165, 250, 0.9);
        border: 2px solid #1d4ed8; z-index: 2147483647; pointer-events: none;
        transform: translate(-50%, -50%); transition: left 0.08s linear, top 0.08s linear;
      }
      .__wt-ripple {
        position: fixed; width: 10px; height: 10px; border-radius: 50%;
        border: 2px solid #f59e0b; z-index: 2147483647; pointer-events: none;
        transform: translate(-50%, -50%); animation: __wt-ripple-anim 0.5s ease-out forwards;
      }
      @keyframes __wt-ripple-anim {
        from { width: 10px; height: 10px; opacity: 0.9; }
        to { width: 46px; height: 46px; opacity: 0; }
      }
    \`;
    document.head.appendChild(style);

    const bar = document.createElement("div");
    bar.id = "__wt-caption-bar";
    bar.textContent = "";
    document.body.appendChild(bar);

    const cursor = document.createElement("div");
    cursor.id = "__wt-cursor";
    document.body.appendChild(cursor);

    document.addEventListener("mousemove", (e) => {
      cursor.style.left = e.clientX + "px";
      cursor.style.top = e.clientY + "px";
    }, { passive: true });

    document.addEventListener("click", (e) => {
      const ripple = document.createElement("div");
      ripple.className = "__wt-ripple";
      ripple.style.left = e.clientX + "px";
      ripple.style.top = e.clientY + "px";
      document.body.appendChild(ripple);
      setTimeout(() => ripple.remove(), 520);
    }, { passive: true, capture: true });

    window.__walkthroughSetCaption = (text) => {
      bar.textContent = text;
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
`;

export async function installOverlay(page: Page): Promise<void> {
  await page.addInitScript(OVERLAY_SCRIPT);
}

/** Updates the on-screen caption bar. Not an app action — an observer-side annotation. */
export async function setCaption(page: Page, text: string): Promise<void> {
  await page.evaluate((t) => {
    const w = window as unknown as { __walkthroughSetCaption?: (s: string) => void };
    w.__walkthroughSetCaption?.(t);
  }, text);
}
