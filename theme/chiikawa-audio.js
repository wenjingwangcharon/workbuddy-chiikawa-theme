(() => {
  "use strict";

  const CARD_SELECTOR = ".conversation-agent-card";
  const WAITING_QUESTION_SELECTOR = ".ask-user-question--waiting";
  const SOUND_ENABLED_KEY = "WORKBUDDY_CHIIKAWA_SOUND_ENABLED";
  const VOLUME_KEY = "WORKBUDDY_CHIIKAWA_SOUND_VOLUME";
  const ACTIVE_STATES = new Set(["working", "pending"]);
  const TRAILING_STATUS_SELECTOR = '[class*="_trailingStatus_"]';

  const successAudio = new Audio("./assets/Yoolooko - 乌拉呀哈呀哈乌拉.wav");
  const questionAudio = new Audio("./assets/Yoolooko - 纳尼纳尼.wav");
  const failedAudio = new Audio("./assets/Yoolooko - 曾曾哇嘎乃.wav");

  const cardStates = new Map();
  let scanTimer = 0;
  let lastPlayedAt = 0;
  let questionScanInitialized = false;
  let questionWasWaiting = false;
  successAudio.preload = "auto";
  questionAudio.preload = "auto";
  failedAudio.preload = "auto";

  function isSoundEnabled() {
    return localStorage.getItem(SOUND_ENABLED_KEY) !== "false";
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
    audio.play().catch(function (error) {
      console.warn("[Chiikawa sound] 播放失败，可能尚未获得音频播放权限。", error);
    });
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

  function start() {
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

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
