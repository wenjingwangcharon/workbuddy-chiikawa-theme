(() => {
  "use strict";

  const CARD_SELECTOR = ".conversation-agent-card";
  const WAITING_QUESTION_SELECTOR = ".ask-user-question--waiting";
  const SKIN_LINK_SELECTOR = 'link[href$="qq2008-skin.css"]';
  const TOGGLE_HOST_SELECTOR = ".conversation-list-logo-row";
  const TOGGLE_BUTTON_ID = "qq2008-skin-toggle";
  const SKIN_ENABLED_KEY = "WORKBUDDY_QQ2008_SKIN_ENABLED";
  const SOUND_ENABLED_KEY = "WORKBUDDY_QQ2008_TASK_SOUND_ENABLED";
  const VOLUME_KEY = "WORKBUDDY_QQ2008_TASK_SOUND_VOLUME";
  const ACTIVE_STATES = new Set(["working", "pending"]);
  const TRAILING_STATUS_SELECTOR = '[class*="_trailingStatus_"]';
  const cardStates = new Map();
  const successAudio = new Audio("./assets/qq-message.wav");
  // 保留旧文件名，避免升级时额外迁移资源；它现在用于 AI 澄清问题提示。
  const questionAudio = new Audio("./assets/qq-failure.wav");
  let scanTimer = 0;
  let lastPlayedAt = 0;
  let questionScanInitialized = false;
  let questionWasWaiting = false;

  successAudio.preload = "auto";
  questionAudio.preload = "auto";

  function isSkinEnabled() {
    return localStorage.getItem(SKIN_ENABLED_KEY) !== "false";
  }

  function isSoundEnabled() {
    return isSkinEnabled() && localStorage.getItem(SOUND_ENABLED_KEY) !== "false";
  }

  function getVolume() {
    const raw = localStorage.getItem(VOLUME_KEY);
    if (raw === null) return 0.8;
    const stored = Number(raw);
    return Number.isFinite(stored) && stored >= 0 && stored <= 1 ? stored : 0.8;
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

    // 独立任务、分组任务和置顶任务不附带 status-* 类：旋转图标表示
    // 工作中，红色错误图标表示失败，其余尾随图标视为仍在等待。
    if (card.querySelector(TRAILING_STATUS_SELECTOR)) return "pending";

    // WorkBuddy 的 compact AgentCard 在完成后会直接移除状态图标和状态文案。
    return "completed";
  }

  function stopAudio(audio) {
    audio.pause();
    audio.currentTime = 0;
  }

  function play(audio) {
    if (!isSoundEnabled()) return;
    const now = Date.now();
    if (now - lastPlayedAt < 1200) return;
    lastPlayedAt = now;
    stopAudio(successAudio);
    stopAudio(questionAudio);
    audio.volume = getVolume();
    audio.play().catch((error) => {
      console.warn("[QQ 2008 task sound] 播放失败，可能尚未获得音频播放权限。", error);
    });
  }

  function playSuccess() {
    play(successAudio);
  }

  function playQuestion() {
    play(questionAudio);
  }

  function styleToggleButton(button, enabled) {
    Object.assign(button.style, {
      marginLeft: "auto",
      flex: "0 0 auto",
      minWidth: "56px",
      height: "26px",
      padding: "0 8px",
      border: enabled ? "1px solid #2d73a8" : "1px solid #9aa6ad",
      borderRadius: "6px",
      background: enabled
        ? "linear-gradient(180deg, #f7fcff 0%, #a9d8f2 48%, #71b7df 52%, #d8f1ff 100%)"
        : "linear-gradient(180deg, #ffffff 0%, #e8ecef 100%)",
      color: enabled ? "#154f78" : "#33434d",
      boxShadow: enabled ? "inset 0 1px #ffffff, 0 1px 2px rgba(30, 83, 120, .2)" : "0 1px 2px rgba(0, 0, 0, .12)",
      font: '12px Tahoma, "PingFang SC", sans-serif',
      lineHeight: "24px",
      whiteSpace: "nowrap",
      cursor: "pointer"
    });
    button.textContent = enabled ? "原版" : "QQ 2008";
    button.title = enabled ? "切换到 WorkBuddy 原版皮肤" : "切换到 QQ 2008 皮肤";
    button.setAttribute("aria-label", button.title);
    button.setAttribute("aria-pressed", String(enabled));
  }

  function applySkinPreference() {
    const enabled = isSkinEnabled();
    const stylesheet = document.querySelector(SKIN_LINK_SELECTOR);
    if (stylesheet) {
      stylesheet.disabled = !enabled;
      stylesheet.media = enabled ? "all" : "not all";
    }
    const button = document.getElementById(TOGGLE_BUTTON_ID);
    if (button) styleToggleButton(button, enabled);
    return enabled;
  }

  function setSkinEnabled(enabled) {
    localStorage.setItem(SKIN_ENABLED_KEY, String(Boolean(enabled)));
    applySkinPreference();
  }

  function ensureToggleButton() {
    const existing = document.getElementById(TOGGLE_BUTTON_ID);
    if (existing) {
      styleToggleButton(existing, isSkinEnabled());
      return existing;
    }
    const host = document.querySelector(TOGGLE_HOST_SELECTOR);
    if (!host) return null;
    const button = document.createElement("button");
    button.id = TOGGLE_BUTTON_ID;
    button.type = "button";
    styleToggleButton(button, isSkinEnabled());
    button.addEventListener("click", () => setSkinEnabled(!isSkinEnabled()));
    host.appendChild(button);
    return button;
  }

  function scanQuestionPrompt() {
    const isWaiting = document.querySelectorAll(WAITING_QUESTION_SELECTOR).length > 0;

    // 首次扫描只建立基线，避免安装或重启后为屏幕上已有的问题补播。
    if (!questionScanInitialized) {
      questionScanInitialized = true;
      questionWasWaiting = isWaiting;
      return;
    }

    if (isWaiting && !questionWasWaiting) playQuestion();
    questionWasWaiting = isWaiting;
  }

  function scan() {
    const seenKeys = new Set();
    for (const card of document.querySelectorAll(CARD_SELECTOR)) {
      const key = getCardKey(card);
      seenKeys.add(key);
      const current = readState(card);
      const previous = cardStates.get(key);
      cardStates.set(key, current);
      if (!previous || previous === current || !ACTIVE_STATES.has(previous)) continue;
      if (current === "completed") playSuccess();
    }
    for (const key of cardStates.keys()) {
      if (!seenKeys.has(key)) cardStates.delete(key);
    }
    scanQuestionPrompt();
    ensureToggleButton();
  }

  function scheduleScan() {
    window.clearTimeout(scanTimer);
    scanTimer = window.setTimeout(scan, 60);
  }

  function start() {
    applySkinPreference();
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
      playQuestion,
      readState,
      scan,
      setEnabled(enabled) {
        localStorage.setItem(SOUND_ENABLED_KEY, String(Boolean(enabled)));
      },
      setVolume(volume) {
        const normalized = Math.min(1, Math.max(0, Number(volume) || 0));
        localStorage.setItem(VOLUME_KEY, String(normalized));
      }
    };
    window.__QQ2008_SKIN__ = {
      isEnabled: isSkinEnabled,
      setEnabled: setSkinEnabled,
      toggle() {
        setSkinEnabled(!isSkinEnabled());
      }
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
