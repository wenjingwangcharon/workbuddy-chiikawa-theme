(() => {
  "use strict";

  const CARD_SELECTOR = ".conversation-agent-card";
  const ENABLED_KEY = "WORKBUDDY_QQ2008_TASK_SOUND_ENABLED";
  const VOLUME_KEY = "WORKBUDDY_QQ2008_TASK_SOUND_VOLUME";
  const ACTIVE_STATES = new Set(["working", "pending"]);
  const cardStates = new WeakMap();
  const successAudio = new Audio("./assets/qq-message.wav");
  const failureAudio = new Audio("./assets/qq-failure.wav");
  let scanTimer = 0;
  let lastPlayedAt = 0;

  successAudio.preload = "auto";
  failureAudio.preload = "auto";

  function isEnabled() {
    return localStorage.getItem(ENABLED_KEY) !== "false";
  }

  function getVolume() {
    const stored = Number(localStorage.getItem(VOLUME_KEY));
    return Number.isFinite(stored) && stored >= 0 && stored <= 1 ? stored : 0.8;
  }

  function getStatusNode(card) {
    if (!(card instanceof HTMLElement) || card.children.length < 2) return null;
    return card.lastElementChild;
  }

  function readState(card) {
    const statusNode = getStatusNode(card);
    if (!statusNode) return "unknown";
    if (statusNode.matches(".status-error") || statusNode.querySelector(".status-error")) return "failed";
    if (statusNode.matches(".status-success") || statusNode.querySelector(".status-success")) return "working";
    if (statusNode.matches(".status-warning") || statusNode.querySelector(".status-warning")) return "pending";

    const text = (statusNode.textContent || "").trim().toLowerCase();
    if (/已完成|完成|completed|complete|done/.test(text)) return "completed";
    if (/失败|错误|已终止|终止|failed|error|terminated|killed/.test(text)) return "failed";
    if (/处理中|工作中|规划中|运行中|执行中|生成中|working|planning|running/.test(text)) return "working";
    if (/等待中|排队中|pending|queued/.test(text)) return "pending";
    return text ? "other" : "unknown";
  }

  function stopAudio(audio) {
    audio.pause();
    audio.currentTime = 0;
  }

  function play(audio) {
    if (!isEnabled()) return;
    const now = Date.now();
    if (now - lastPlayedAt < 1200) return;
    lastPlayedAt = now;
    stopAudio(successAudio);
    stopAudio(failureAudio);
    audio.volume = getVolume();
    audio.play().catch((error) => {
      console.warn("[QQ 2008 task sound] 播放失败，可能尚未获得音频播放权限。", error);
    });
  }

  function playSuccess() {
    play(successAudio);
  }

  function playFailure() {
    play(failureAudio);
  }

  function scan() {
    for (const card of document.querySelectorAll(CARD_SELECTOR)) {
      const current = readState(card);
      const previous = cardStates.get(card);
      cardStates.set(card, current);
      if (!previous || previous === current || !ACTIVE_STATES.has(previous)) continue;
      if (current === "completed") playSuccess();
      else if (current === "failed") playFailure();
    }
  }

  function scheduleScan() {
    window.clearTimeout(scanTimer);
    scanTimer = window.setTimeout(scan, 60);
  }

  function start() {
    scan();
    const observer = new MutationObserver(scheduleScan);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["class"]
    });
    window.setInterval(scan, 1500);
    window.__QQ2008_TASK_SOUND__ = {
      playSuccess,
      playFailure,
      readState,
      scan,
      setEnabled(enabled) {
        localStorage.setItem(ENABLED_KEY, String(Boolean(enabled)));
      },
      setVolume(volume) {
        const normalized = Math.min(1, Math.max(0, Number(volume) || 0));
        localStorage.setItem(VOLUME_KEY, String(normalized));
      }
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
