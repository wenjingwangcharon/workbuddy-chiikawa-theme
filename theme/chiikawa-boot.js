(() => {
  "use strict";

  // ======================================================================
  // Chiikawa boot payload (v3) — INLINED into renderer/index.html by the
  // installer (the placeholder tokens below are replaced at install time
  // with JSON-encoded skin CSS text and sound URLs).
  //
  // Why inline? The window loads index.html via the ASAR virtual path
  // (app.asar/renderer/index.html). Relative ./assets/... URLs resolve
  // through the ASAR header, and files we merely drop on disk under
  // app.asar.unpacked are NOT in that header — an external
  // <script src="./assets/chiikawa-boot.js"> therefore never loads.
  // Inline script content cannot fail to load; all images and sounds are
  // embedded as data: URIs at install time (WorkBuddy registers no custom
  // file protocol, so disk URLs in css would never load).
  //
  // v3 persistence strategy (why the v2 <style>+MutationObserver lost):
  // WorkBuddy's skin manager applies theme CSS through a CONSTRUCTED
  // stylesheet stored in document.adoptedStyleSheets. Entries there beat
  // ANY <style>/<link> in the document regardless of order, so a plain
  // injected <style> can never win after the engine writes official css.
  // Fix: we keep our OWN CSSStyleSheet inside adoptedStyleSheets too, and
  // hook the adoptedStyleSheets accessor so our sheet is ALWAYS last in
  // the array (last = highest cascade priority). Whatever the engine
  // writes, applies or clears, the skin stays Chiikawa on every launch.
  //
  // Toggles (WorkBuddy devtools console):
  //   __CHIIKAWA_SKIN__.setEnabled(false)   // disable skin CSS
  //   __CHIIKAWA_AUDIO__.setEnabled(false)  // disable sounds
  // ======================================================================

  if (window.__CHIIKAWA_BOOT_V3__) return;
  window.__CHIIKAWA_BOOT_V3__ = true;

  const SKIN_CSS = __CHIIKAWA_SKIN_CSS__;
  const SOUNDS = __CHIIKAWA_SOUNDS__ || null;

  const SKIN_ENABLED_KEY = "WORKBUDDY_CHIIKAWA_SKIN_ENABLED";
  const SOUND_ENABLED_KEY = "WORKBUDDY_CHIIKAWA_SOUND_ENABLED";
  const VOLUME_KEY = "WORKBUDDY_CHIIKAWA_SOUND_VOLUME";
  const STYLE_ID = "chiikawa-skin-style";

  function skinEnabled() {
    try { return localStorage.getItem(SKIN_ENABLED_KEY) !== "false"; } catch { return true; }
  }

  // ---------------- skin CSS ----------------
  let adoptedSheet = null;   // CSSStyleSheet path
  let protoDesc = null;      // original adoptedStyleSheets descriptor
  let styleEl = null;        // <style> fallback path

  function placeSheetLast(arr) {
    const list = Array.isArray(arr) ? arr.filter((s) => s !== adoptedSheet) : [];
    if (!skinEnabled()) return list;
    return list.concat(adoptedSheet);
  }

  function startSkinAdopted() {
    adoptedSheet = new CSSStyleSheet();
    adoptedSheet.replaceSync(SKIN_CSS);
    protoDesc = Object.getOwnPropertyDescriptor(Document.prototype, "adoptedStyleSheets");
    if (!protoDesc || typeof protoDesc.get !== "function") throw new Error("adoptedStyleSheets accessor unavailable");
    Object.defineProperty(document, "adoptedStyleSheets", {
      configurable: true,
      get() { return placeSheetLast(protoDesc.get.call(document)); },
      set(v) { protoDesc.set.call(document, placeSheetLast(v)); },
    });
  }

  function ensureStyleLast() {
    if (!skinEnabled()) return;
    if (!document.head) return;
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = STYLE_ID;
      styleEl.setAttribute("data-chiikawa-skin", "1");
      styleEl.textContent = SKIN_CSS;
      document.head.appendChild(styleEl);
      return;
    }
    if (document.head.lastElementChild !== styleEl) document.head.appendChild(styleEl);
  }

  function startSkinFallback() {
    ensureStyleLast();
    new MutationObserver(ensureStyleLast).observe(document.head, { childList: true });
  }

  function removeSkinVisual() {
    if (adoptedSheet && protoDesc) {
      const cur = protoDesc.get.call(document) || [];
      protoDesc.set.call(document, cur.filter((s) => s !== adoptedSheet));
    }
    if (styleEl) { styleEl.remove(); styleEl = null; }
  }

  function startSkin() {
    let viaAdopted = false;
    try {
      if (typeof CSSStyleSheet !== "undefined" && "adoptedStyleSheets" in Document.prototype) {
        startSkinAdopted();
        viaAdopted = true;
      }
    } catch (e) {
      viaAdopted = false;
    }
    if (!viaAdopted) startSkinFallback();
    window.__CHIIKAWA_SKIN__ = {
      isEnabled: skinEnabled,
      setEnabled: function (enabled) {
        try { localStorage.setItem(SKIN_ENABLED_KEY, String(Boolean(enabled))); } catch {}
        if (!enabled) removeSkinVisual();
        else if (viaAdopted) protoDesc.set.call(document, placeSheetLast(protoDesc.get.call(document)));
        else ensureStyleLast();
      },
    };
  }

  // ---------------- click sounds ----------------
  const CARD_SELECTOR = ".conversation-agent-card";
  const WAITING_QUESTION_SELECTOR = ".ask-user-question--waiting";
  const ACTIVE_STATES = new Set(["working", "pending"]);
  const TRAILING_STATUS_SELECTOR = '[class*="_trailingStatus_"]';

  let successAudio, questionAudio, failedAudio;
  const cardStates = new Map();
  let scanTimer = 0;
  let lastPlayedAt = 0;
  let questionScanInitialized = false;
  let questionWasWaiting = false;

  function isSoundEnabled() {
    try { return localStorage.getItem(SOUND_ENABLED_KEY) !== "false"; } catch { return true; }
  }

  function getVolume() {
    const raw = localStorage.getItem(VOLUME_KEY);
    if (raw === null) return 0.7;
    const stored = Number(raw);
    return Number.isFinite(stored) && stored >= 0 && stored <= 1 ? stored : 0.7;
  }

  function getCardKey(card) {
    const host = card.closest?.("[data-conversation-id]");
    return host?.getAttribute("data-conversation-id") || card;
  }

  function readState(card) {
    if (!(card instanceof HTMLElement)) return "unknown";
    if (card.querySelector('.status-error, [class*="_trailingStatus_"] path[fill="#F64041"]')) return "failed";
    if (card.querySelector(".status-success, .wb-icon--spin")) return "working";
    if (card.querySelector(".status-warning")) return "pending";
    if (card.querySelector(".status-completed")) return "completed";
    if (card.querySelector(".status-secondary")) return "other";

    const statusTextNode = card.querySelector('[class*="_status_"]');
    const text = (statusTextNode?.textContent || "").trim().toLowerCase();
    if (/已完成|完成|completed|complete|done/.test(text)) return "completed";
    if (/失败|错误|已终止|终止|failed|error|terminated|killed/.test(text)) return "failed";
    if (/处理中|工作中|规划中|运行中|执行中|生成中|working|planning|running/.test(text)) return "working";
    if (/等待中|排队中|pending|queued/.test(text)) return "pending";
    if (text) return "other";

    if (card.querySelector(TRAILING_STATUS_SELECTOR)) return "pending";
    return "completed";
  }

  function stopAllAudio() {
    [successAudio, questionAudio, failedAudio].forEach(function (a) {
      a.pause();
      a.currentTime = 0;
    });
  }

  function play(audio) {
    if (!isSoundEnabled()) return;
    var now = Date.now();
    if (now - lastPlayedAt < 1200) return;
    lastPlayedAt = now;
    stopAllAudio();
    audio.volume = getVolume();
    audio.play().catch(function () { /* autoplay may be blocked until first user gesture */ });
  }

  function playSuccess() { play(successAudio); }
  function playQuestion() { play(questionAudio); }
  function playFailed() { play(failedAudio); }

  function scanQuestionPrompt() {
    var isWaiting = document.querySelectorAll(WAITING_QUESTION_SELECTOR).length > 0;

    if (!questionScanInitialized) {
      questionScanInitialized = true;
      questionWasWaiting = isWaiting;
      return;
    }

    if (isWaiting && !questionWasWaiting) playQuestion();
    questionWasWaiting = isWaiting;
  }

  function scan() {
    var seenKeys = new Set();
    document.querySelectorAll(CARD_SELECTOR).forEach(function (card) {
      var key = getCardKey(card);
      seenKeys.add(key);
      var current = readState(card);
      var previous = cardStates.get(key);
      cardStates.set(key, current);
      if (!previous || previous === current || !ACTIVE_STATES.has(previous)) return;
      if (current === "completed") playSuccess();
      if (current === "failed") playFailed();
    });
    cardStates.forEach(function (_, key) {
      if (!seenKeys.has(key)) cardStates.delete(key);
    });
    scanQuestionPrompt();
  }

  function scheduleScan() {
    window.clearTimeout(scanTimer);
    scanTimer = window.setTimeout(scan, 60);
  }

  function startAudio() {
    try {
      successAudio = new Audio(SOUNDS.success);
      questionAudio = new Audio(SOUNDS.question);
      failedAudio = new Audio(SOUNDS.failed);
      [successAudio, questionAudio, failedAudio].forEach(function (a) { a.preload = "auto"; });
    } catch (e) {
      return;
    }
    scan();
    var observer = new MutationObserver(scheduleScan);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["class"]
    });
    window.setInterval(scan, 1500);
    window.__CHIIKAWA_AUDIO__ = {
      playSuccess: playSuccess,
      playQuestion: playQuestion,
      playFailed: playFailed,
      setEnabled: function (enabled) {
        localStorage.setItem(SOUND_ENABLED_KEY, String(Boolean(enabled)));
      },
      setVolume: function (volume) {
        var normalized = Math.min(1, Math.max(0, Number(volume) || 0));
        localStorage.setItem(VOLUME_KEY, String(normalized));
      }
    };
  }

  function start() {
    try { startSkin(); } catch (e) { console.warn("[Chiikawa] skin boot failed:", e); }
    if (SOUNDS) try { startAudio(); } catch (e) { console.warn("[Chiikawa] audio boot failed:", e); }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
