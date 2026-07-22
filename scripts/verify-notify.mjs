#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const script = fs.readFileSync(path.resolve("theme/qq2008-notify.js"), "utf8");
let now = 10_000;
const audioInstances = [];
const cards = [];

class FakeDate extends Date {
  static now() {
    return now;
  }
}

class FakeHTMLElement {}

class FakeCard extends FakeHTMLElement {
  constructor(id, state, layout = "standalone") {
    super();
    this.id = id;
    this.state = state;
    this.layout = layout;
    // WorkBuddy 5.3.3 renders compact AgentCard with one direct header child.
    this.children = [{}];
  }
  closest(selector) {
    if (selector !== "[data-conversation-id]") return null;
    return {
      getAttribute: (name) => name === "data-conversation-id" ? this.id : null
    };
  }
  querySelector(selector) {
    if (selector === '.status-error, [class*="_trailingStatus_"] path[fill="#F64041"]') {
      return this.state === "failed" ? {} : null;
    }
    if (selector === ".status-success, .wb-icon--spin") {
      return this.state === "working" ? {} : null;
    }
    if (selector === ".status-warning") {
      return this.layout === "regular" && this.state === "pending" ? {} : null;
    }
    if (selector === ".status-completed") return null;
    if (selector === ".status-secondary") return this.state === "archived" ? {} : null;
    if (selector === '[class*="_status_"]') return null;
    if (selector === '[class*="_trailingStatus_"]') {
      return this.layout !== "regular" && ["working", "pending", "failed"].includes(this.state) ? {} : null;
    }
    return null;
  }
}

class FakeAudio {
  constructor(src) {
    this.src = src;
    this.currentTime = 0;
    this.volume = 1;
    this.playCount = 0;
    audioInstances.push(this);
  }
  pause() {}
  play() {
    this.playCount += 1;
    return Promise.resolve();
  }
}

const localValues = new Map();
const fakeWindow = {
  clearTimeout() {},
  setTimeout(callback) {
    callback();
    return 1;
  },
  setInterval() {
    return 1;
  }
};

vm.runInNewContext(script, {
  Audio: FakeAudio,
  Date: FakeDate,
  HTMLElement: FakeHTMLElement,
  MutationObserver: class { observe() {} },
  console,
  document: {
    readyState: "complete",
    body: {},
    querySelectorAll() {
      return cards;
    }
  },
  localStorage: {
    getItem(key) {
      return localValues.get(key) ?? null;
    },
    setItem(key, value) {
      localValues.set(key, value);
    }
  },
  window: fakeWindow
});

const api = fakeWindow.__QQ2008_TASK_SOUND__;
assert.ok(api, "notification debug API should be exposed");
const successCard = new FakeCard("success-task", "working");
const failureCard = new FakeCard("failure-task", "working");
cards.push(successCard, failureCard);
api.scan();
assert.equal(audioInstances[0].playCount + audioInstances[1].playCount, 0, "initial scan must stay silent");

successCard.state = "completed";
api.scan();
assert.equal(audioInstances.find((audio) => audio.src.endsWith("qq-message.wav")).playCount, 1);
assert.equal(
  audioInstances.find((audio) => audio.src.endsWith("qq-message.wav")).volume,
  0.8,
  "missing volume preference must use the audible default instead of coercing null to zero"
);

now += 2_000;
failureCard.state = "failed";
api.scan();
assert.equal(audioInstances.find((audio) => audio.src.endsWith("qq-failure.wav")).playCount, 1);

api.scan();
assert.equal(audioInstances.reduce((sum, audio) => sum + audio.playCount, 0), 2, "terminal state must not replay");

now += 2_000;
const replacementWorkingCard = new FakeCard("replacement-task", "working");
cards.splice(0, cards.length, replacementWorkingCard);
api.scan();
cards[0] = new FakeCard("replacement-task", "completed");
api.scan();
assert.equal(
  audioInstances.find((audio) => audio.src.endsWith("qq-message.wav")).playCount,
  2,
  "status history must survive a React card-node replacement"
);

now += 2_000;
cards[0] = new FakeCard("already-completed-task", "completed");
api.scan();
assert.equal(
  audioInstances.reduce((sum, audio) => sum + audio.playCount, 0),
  3,
  "a completed card first seen after rendering must stay silent"
);
console.log("QQ 2008 task sound transitions verified");
