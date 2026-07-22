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

class FakeStatusNode {
  constructor(state) {
    this.state = state;
  }
  get textContent() {
    return {
      working: "运行中",
      pending: "等待中",
      completed: "已完成",
      failed: "失败"
    }[this.state] || "";
  }
  matches(selector) {
    return selector === ".status-success" && this.state === "working"
      || selector === ".status-warning" && this.state === "pending"
      || selector === ".status-error" && this.state === "failed";
  }
  querySelector() {
    return null;
  }
}

class FakeCard extends FakeHTMLElement {
  constructor(state) {
    super();
    this.status = new FakeStatusNode(state);
    this.children = [{}, this.status];
  }
  get lastElementChild() {
    return this.status;
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
const successCard = new FakeCard("working");
const failureCard = new FakeCard("working");
cards.push(successCard, failureCard);
api.scan();
assert.equal(audioInstances[0].playCount + audioInstances[1].playCount, 0, "initial scan must stay silent");

successCard.status.state = "completed";
api.scan();
assert.equal(audioInstances.find((audio) => audio.src.endsWith("qq-message.wav")).playCount, 1);

now += 2_000;
failureCard.status.state = "failed";
api.scan();
assert.equal(audioInstances.find((audio) => audio.src.endsWith("qq-failure.wav")).playCount, 1);

api.scan();
assert.equal(audioInstances.reduce((sum, audio) => sum + audio.playCount, 0), 2, "terminal state must not replay");
console.log("QQ 2008 task sound transitions verified");
