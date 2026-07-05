"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => TomatoPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian2 = require("obsidian");

// src/view.ts
var import_obsidian = require("obsidian");

// src/types.ts
var DEFAULT_SETTINGS = {
  exportPath: "Pomodoro Logs"
};
var PRESETS = {
  "25/5": { focus: 25, shortBreak: 5, longBreak: 15, color: "#ba4949" },
  "52/17": { focus: 52, shortBreak: 17, longBreak: 17, color: "#38858a" },
  "90": { focus: 90, shortBreak: 25, longBreak: 25, color: "#397097" }
};

// src/view.ts
var VIEW_TYPE = "tomato-life-view";
function fmt(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
var TomatoView = class extends import_obsidian.ItemView {
  // ── Obsidian API ──
  constructor(leaf, data) {
    super(leaf);
    // ── 计时器状态 ──
    this.preset = "25/5";
    // 当前预设名
    this.subMode = "focus";
    // 'focus' | 'break' | 'break-long'
    this.sec = 25 * 60;
    this.run = false;
    this.iv = null;
    this.round = 1;
    // 25/5 四轮计数
    this.pomodoroCount = 0;
    this.taskMode = "tasks";
    // 'tasks' | 'gtd'
    this.customPreset = null;
    // ── 数据 ──
    this.gtdItems = [];
    this.gtdId = 0;
    this.gtdSelectedId = null;
    this.gtdRenamingId = null;
    this.tasks = [];
    this.tid = 0;
    this.sessions = [];
    this.sessionStart = null;
    // ═══════════════════════ 文件轮询 ═══════════════════════
    this.writing = false;
    this.pollTimer = null;
    this.tasksFingerprint = "";
    this.gtdFingerprint = "";
    // ═══════════════════════ GTD 面板 ═══════════════════════
    this.activeAddCol = null;
    this.data = data;
  }
  getViewType() {
    return VIEW_TYPE;
  }
  getDisplayText() {
    return "Pomodoro";
  }
  getIcon() {
    return "timer";
  }
  // ═══════════════════════ Lifecycle ═══════════════════════
  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("tomato-life-view");
    this.gtdItems = await this.data.loadGtdItems();
    this.gtdId = this.gtdItems.length > 0 ? Math.max(...this.gtdItems.map((i) => i.id)) + 1 : 0;
    this.tasks = await this.data.loadTasks();
    this.tid = this.tasks.length > 0 ? Math.max(...this.tasks.map((t) => t.id)) + 1 : 0;
    this.sessions = await this.data.loadTodaySessions();
    this.pomodoroCount = this.sessions.length;
    this.buildUI();
    this.renderSubTabs();
    this.applyColors();
    this.upd();
    this.renderTasks();
    this.renderDotGrid();
    container.querySelectorAll("#tl-presetTabs .tl-tab-btn").forEach(
      (b) => b.onclick = () => this.setPreset(b.dataset.preset)
    );
    container.querySelectorAll("#tl-taskModeTabs .tl-tab-btn").forEach(
      (b) => b.onclick = () => this.setTaskMode(b.dataset.taskmode)
    );
    this.startPolling();
  }
  async onClose() {
    if (this.iv) clearInterval(this.iv);
    this.stopPolling();
  }
  startPolling() {
    const tasksPath = this.data.getTasksPath();
    const gtdPath = this.data.getGtdPath();
    this.updateTaskFingerprint();
    this.updateGtdFingerprint();
    this.pollTimer = setInterval(async () => {
      if (this.writing) {
        this.updateTaskFingerprint();
        this.updateGtdFingerprint();
        return;
      }
      try {
        const tasksFile = this.app.vault.getAbstractFileByPath(tasksPath);
        if (tasksFile) {
          const c = await this.app.vault.read(tasksFile);
          if (c !== this.tasksFingerprint) {
            this.tasksFingerprint = c;
            this.tasks = await this.data.loadTasks();
            this.tid = this.tasks.length > 0 ? Math.max(...this.tasks.map((t) => t.id)) + 1 : 0;
            this.renderTasks();
          }
        }
        const gtdFile = this.app.vault.getAbstractFileByPath(gtdPath);
        if (gtdFile) {
          const c = await this.app.vault.read(gtdFile);
          if (c !== this.gtdFingerprint) {
            this.gtdFingerprint = c;
            this.gtdItems = await this.data.loadGtdItems();
            this.gtdId = this.gtdItems.length > 0 ? Math.max(...this.gtdItems.map((i) => i.id)) + 1 : 0;
            this.renderGtd();
          }
        }
      } catch {
      }
    }, 2e3);
  }
  updateTaskFingerprint() {
    const f = this.app.vault.getAbstractFileByPath(this.data.getTasksPath());
    if (f) this.app.vault.read(f).then((c) => {
      this.tasksFingerprint = c;
    }).catch(() => {
    });
  }
  updateGtdFingerprint() {
    const f = this.app.vault.getAbstractFileByPath(this.data.getGtdPath());
    if (f) this.app.vault.read(f).then((c) => {
      this.gtdFingerprint = c;
    }).catch(() => {
    });
  }
  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
  // ═══════════════════════ UI 构建（一次性） ═══════════════════════
  buildUI() {
    const c = this.containerEl.children[1];
    c.innerHTML = `
      <!-- \u9884\u8BBE\u5C42 -->
      <div class="tl-tabs" id="tl-presetTabs">
        <button class="tl-tab-btn active" data-preset="25/5">25/5</button>
        <button class="tl-tab-btn" data-preset="52/17">52/17</button>
        <button class="tl-tab-btn" data-preset="90">90/25</button>
        <button class="tl-tab-btn" data-preset="custom">Custom</button>
      </div>

      <div class="tl-tabs" id="tl-subTabs"></div>

      <div class="tl-card">
        <div class="tl-timer-wrap">
          <div class="tl-timer-num" id="tl-time">25:00</div>
        </div>
      </div>

      <button class="tl-btn-start" id="tl-startBtn">START</button>
      <button class="tl-skip-btn" id="tl-skipBtn" style="visibility:hidden">Skip</button>

      <div class="tl-free-edit-toggle" id="tl-freeEditToggle" style="display:none">
        <span class="tl-click-change" id="tl-clickToChange">Click to change</span>
        <div class="tl-dur-edit" id="tl-durEdit" style="display:none;text-align:center;padding:6px 0 0 0">
          <input id="tl-durFocus" type="number" min="1" max="300" value="25"> <span style="color:rgba(255,255,255,0.6)">min focus</span>
          <span style="color:rgba(255,255,255,0.3);margin:0 4px">/</span>
          <input id="tl-durBreak" type="number" min="1" max="120" value="5"> <span style="color:rgba(255,255,255,0.6)">min break</span>
          <button id="tl-saveDur" style="margin-left:8px">OK</button>
        </div>
      </div>

      <div class="tl-info">
        <div class="tl-dot-grid" id="tl-dotGrid"></div>
      </div>

      <div class="tl-tabs" id="tl-taskModeTabs" style="margin-top:4px;margin-bottom:0">
        <button class="tl-tab-btn active" data-taskmode="tasks">Tasks</button>
        <button class="tl-tab-btn" data-taskmode="gtd">GTD</button>
      </div>

      <div class="tl-tasks-wrap">
        <div class="tl-tasks-head">
          <span id="tl-taskModeLabel">Tasks</span>
          <div style="display:flex;gap:4px;align-items:center">
            <button id="tl-addTaskBtn">+ Add Task</button>
          </div>
        </div>

        <div id="tl-tasksContent">
          <div id="tl-tasks"></div>
          <div id="tl-addArea" style="display:none">
            <div class="tl-task">
              <div class="tl-task-left" style="flex:1">
                <div style="width:18px;height:18px;flex-shrink:0;margin-right:8px"></div>
                <input id="tl-addInput" class="tl-add-input" placeholder="What are you working on?" autofocus>
                <input id="tl-addEst" class="tl-add-est" type="number" min="1" max="99" value="1">
              </div>
              <div style="display:flex;align-items:center;gap:3px;flex-shrink:0">
                <button class="tl-add-cancel" id="tl-cancelAdd">Cancel</button>
                <button class="tl-add-confirm" id="tl-confirmAdd">Save</button>
              </div>
            </div>
          </div>
          <div class="tl-est">Est: <strong id="tl-estT">0</strong> pomodoros</div>
        </div>

        <div id="tl-gtdContent" style="display:none">
          <div class="tl-gtd-board">
            <div class="tl-gtd-col">
              <div class="tl-gtd-col-header"><span>CAPTURE</span><button id="tl-gtdAdd-inbox">+ Add</button></div>
              <div id="tl-gtdAddRow-inbox" class="tl-gtd-col-input" style="display:none">
                <input placeholder="type and Enter"><button class="tl-gtd-add-btn">+</button>
              </div>
              <div class="tl-gtd-col-body" id="tl-gtdColCapture"></div>
            </div>
            <div class="tl-gtd-col">
              <div class="tl-gtd-col-header"><span>CLARIFY</span><button id="tl-gtdAdd-clarify">+ Add</button></div>
              <div id="tl-gtdAddRow-clarify" class="tl-gtd-col-input" style="display:none">
                <input placeholder="type and Enter"><button class="tl-gtd-add-btn">+</button>
              </div>
              <div class="tl-gtd-col-body" id="tl-gtdColClarify"></div>
            </div>
            <div class="tl-gtd-col">
              <div class="tl-gtd-col-header"><span>NEXT</span><button id="tl-gtdAdd-next">+ Add</button></div>
              <div id="tl-gtdAddRow-next" class="tl-gtd-col-input" style="display:none">
                <input placeholder="type and Enter"><button class="tl-gtd-add-btn">+</button>
              </div>
              <div class="tl-gtd-col-body" id="tl-gtdColNext"></div>
            </div>
            <div class="tl-gtd-col">
              <div class="tl-gtd-col-header"><span>DOING</span></div>
              <div class="tl-gtd-col-body" id="tl-gtdColDoing"></div>
            </div>
          </div>
        </div>
      </div>
    `;
    this.el("tl-startBtn").onclick = () => this.toggle();
    this.el("tl-skipBtn").onclick = () => this.skip();
    this.el("tl-clickToChange").onclick = () => this.toggleDurEdit();
    this.el("tl-saveDur").onclick = () => this.saveDuration();
    this.el("tl-addTaskBtn").onclick = () => this.addTask();
    this.el("tl-confirmAdd").onclick = () => this.confirmAdd();
    this.el("tl-cancelAdd").onclick = () => this.cancelAdd();
    this.el("tl-addInput").onkeydown = (e) => {
      if (e.key === "Enter") this.confirmAdd();
    };
    ["inbox", "clarify", "next"].forEach((col) => {
      this.el(`tl-gtdAdd-${col}`).onclick = () => this.gtdShowAdd(col);
      const row = this.el(`tl-gtdAddRow-${col}`);
      const inp = row.querySelector("input");
      const btn = row.querySelector("button");
      inp.onkeydown = (e) => {
        if (e.key === "Enter") this.gtdConfirmAdd(col);
      };
      btn.onclick = () => this.gtdConfirmAdd(col);
    });
  }
  el(id) {
    return this.containerEl.querySelector(`#${id}`);
  }
  // ═══════════════════════ 计时器引擎 ═══════════════════════
  upd() {
    this.el("tl-time").textContent = fmt(this.sec);
  }
  getPreset() {
    if (this.preset === "custom") {
      if (!this.customPreset) {
        const cp = PRESETS["25/5"];
        this.customPreset = { focus: cp.focus, shortBreak: cp.shortBreak, longBreak: cp.shortBreak, color: "#7a5c8a" };
      }
      return this.customPreset;
    }
    return PRESETS[this.preset];
  }
  getSubTabs() {
    const p = this.getPreset();
    if (this.preset === "25/5") {
      return [
        { id: "focus", label: "Focus", color: p.color, min: p.focus },
        { id: "break", label: "Short Break", color: "#38858a", min: p.shortBreak },
        { id: "break-long", label: "Long Break", color: "#397097", min: p.longBreak }
      ];
    }
    return [
      { id: "focus", label: "Focus", color: p.color, min: p.focus },
      { id: "break", label: "Break", color: p.color, min: p.shortBreak }
    ];
  }
  renderSubTabs() {
    const tabs = this.getSubTabs();
    const html = tabs.map(
      (t) => `<button class="tl-tab-btn${this.subMode === t.id ? " active" : ""}" data-submode="${t.id}">${t.label}</button>`
    ).join("");
    this.el("tl-subTabs").innerHTML = html;
    this.el("tl-subTabs").querySelectorAll(".tl-tab-btn").forEach(
      (b) => b.onclick = () => this.setSubMode(b.dataset.submode)
    );
  }
  applyColors() {
    const tabs = this.getSubTabs();
    const t = tabs.find((x) => x.id === this.subMode) || tabs[0];
    const container = this.containerEl.children[1];
    container.style.background = t.color;
    container.classList.remove("mode--break-short", "mode--break-long");
    if (this.subMode === "break") {
      container.classList.add("mode--break-short");
    } else if (this.subMode === "break-long") {
      container.classList.add("mode--break-long");
    }
    const startBtn = this.el("tl-startBtn");
    startBtn.style.color = t.color;
    container.querySelectorAll(".tl-task-dot.done").forEach((d) => {
      d.style.background = t.color;
      d.style.borderColor = t.color;
    });
    container.style.setProperty("--tl-accent", t.color);
  }
  setPreset(p) {
    if (this.run) this.toggle();
    if (p === "custom" && !this.customPreset) {
      const cp = this.getPreset();
      this.customPreset = { focus: cp.focus, shortBreak: cp.shortBreak, longBreak: cp.shortBreak, color: "#7a5c8a" };
    }
    this.preset = p;
    this.subMode = "focus";
    this.sec = this.getPreset().focus * 60;
    this.upd();
    this.el("tl-presetTabs").querySelectorAll(".tl-tab-btn").forEach(
      (b) => b.classList.toggle("active", b.dataset.preset === p)
    );
    this.renderSubTabs();
    this.applyColors();
    this.el("tl-startBtn").textContent = "START";
    this.el("tl-startBtn").className = "tl-btn-start";
    this.el("tl-skipBtn").style.visibility = "hidden";
    this.el("tl-freeEditToggle").style.display = p === "custom" ? "block" : "none";
    this.el("tl-durEdit").style.display = "none";
  }
  setSubMode(m) {
    if (this.run) this.toggle();
    this.subMode = m;
    const tabs = this.getSubTabs();
    const t = tabs.find((x) => x.id === m) || tabs[0];
    this.sec = t.min * 60;
    this.upd();
    this.el("tl-subTabs").querySelectorAll(".tl-tab-btn").forEach(
      (b) => b.classList.toggle("active", b.dataset.submode === m)
    );
    this.applyColors();
    this.el("tl-startBtn").textContent = "START";
    this.el("tl-startBtn").className = "tl-btn-start";
    this.el("tl-skipBtn").style.visibility = m === "focus" ? "hidden" : "visible";
  }
  // ── 自由模式时长编辑 ──
  toggleDurEdit() {
    const ed = this.el("tl-durEdit");
    if (ed.style.display === "none" || !ed.style.display) {
      if (this.run) return;
      const p = this.getPreset();
      this.el("tl-durFocus").value = String(p.focus);
      this.el("tl-durBreak").value = String(p.shortBreak);
      ed.style.display = "block";
      this.el("tl-durFocus").focus();
    } else {
      ed.style.display = "none";
    }
  }
  saveDuration() {
    const f = parseInt(this.el("tl-durFocus").value);
    const b = parseInt(this.el("tl-durBreak").value);
    if (!f || !b || f < 1 || b < 1) return;
    this.el("tl-durEdit").style.display = "none";
    this.customPreset = { focus: f, shortBreak: b, longBreak: b, color: "#7a5c8a" };
    this.setPreset("custom");
  }
  // ── 计时器主逻辑 ──
  toggle() {
    this.run = !this.run;
    const startBtn = this.el("tl-startBtn");
    startBtn.textContent = this.run ? "PAUSE" : "START";
    startBtn.className = "tl-btn-start" + (this.run ? " is-paused" : "");
    const tabs = this.getSubTabs();
    const t = tabs.find((x) => x.id === this.subMode);
    startBtn.style.color = this.run ? "#fff" : t?.color || "#ba4949";
    this.el("tl-skipBtn").style.visibility = this.run ? "visible" : this.subMode === "focus" ? "hidden" : "visible";
    if (this.run) {
      if (this.subMode === "focus") {
        this.sessionStart = (/* @__PURE__ */ new Date()).toISOString();
      }
      const startMs = Date.now();
      const totalSec = this.sec;
      this.iv = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startMs) / 1e3);
        this.sec = Math.max(0, totalSec - elapsed);
        this.upd();
        if (this.sec <= 0) {
          clearInterval(this.iv);
          this.iv = null;
          this.run = false;
          this.el("tl-startBtn").textContent = "START";
          this.el("tl-startBtn").className = "tl-btn-start";
          this.onTimerEnd();
        }
      }, 1e3);
    } else {
      if (this.iv) {
        clearInterval(this.iv);
        this.iv = null;
      }
      this.sessionStart = null;
    }
  }
  onTimerEnd() {
    this.playBell();
    if (this.subMode === "focus") {
      const end = (/* @__PURE__ */ new Date()).toISOString();
      const p = this.getPreset();
      const dur = p.focus;
      const doingItem = this.gtdItems.find((x) => x.col === "doing");
      const session = {
        start: this.sessionStart || end,
        end,
        duration: dur,
        preset: this.preset,
        task: doingItem ? doingItem.text : ""
      };
      this.sessions.push(session);
      this.sessionStart = null;
      this.data.appendSession(session).catch((e) => console.warn("Session save failed:", e));
      this.pomodoroCount++;
      this.renderDotGrid();
      this.round++;
      this.setSubMode(
        this.round % 4 === 0 && this.preset === "25/5" ? "break-long" : "break"
      );
    } else {
      this.setSubMode("focus");
    }
  }
  skip() {
    if (this.run) this.toggle();
    if (this.subMode === "focus") {
      this.pomodoroCount++;
      this.renderDotGrid();
      this.round++;
      this.setSubMode(
        this.round % 4 === 0 && this.preset === "25/5" ? "break-long" : "break"
      );
    } else {
      this.setSubMode("focus");
    }
  }
  playBell() {
    try {
      const ctx = new AudioContext();
      if (ctx.state === "suspended") ctx.resume();
      const now = ctx.currentTime;
      const notes = [1046.5, 783.99, 659.25, 523.25];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.6, now + i * 0.2);
        gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.2 + 0.6);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.2);
        osc.stop(now + i * 0.2 + 0.7);
      });
    } catch {
    }
  }
  // ═══════════════════════ 点阵 ═══════════════════════
  renderDotGrid() {
    const MAX = 30;
    const count = Math.min(this.pomodoroCount, MAX);
    let html = "";
    for (let i = 0; i < MAX; i++) {
      html += `<div class="tl-grid-dot${i < count ? " lit" : ""}" data-dotidx="${i}"></div>`;
    }
    this.el("tl-dotGrid").innerHTML = html;
    this.el("tl-dotGrid").querySelectorAll(".tl-grid-dot").forEach((d) => {
      d.onclick = () => this.toggleDot(parseInt(d.dataset.dotidx));
    });
  }
  toggleDot(i) {
    this.pomodoroCount = i < this.pomodoroCount ? i : i + 1;
    this.renderDotGrid();
  }
  // ═══════════════════════ 任务模式切换 ═══════════════════════
  setTaskMode(mode) {
    this.taskMode = mode;
    this.el("tl-taskModeTabs").querySelectorAll(".tl-tab-btn").forEach(
      (b) => b.classList.toggle("active", b.dataset.taskmode === mode)
    );
    this.el("tl-taskModeLabel").textContent = mode === "tasks" ? "Tasks" : "GTD";
    this.el("tl-addTaskBtn").style.display = mode === "tasks" ? "inline-block" : "none";
    this.el("tl-tasksContent").style.display = mode === "tasks" ? "block" : "none";
    this.el("tl-gtdContent").style.display = mode === "gtd" ? "block" : "none";
    if (mode === "gtd") this.renderGtd();
    if (mode === "tasks") this.renderTasks();
    const wrap = this.containerEl.querySelector(".tl-tasks-wrap");
    if (wrap) {
      wrap.style.maxWidth = mode === "gtd" ? "1400px" : "480px";
      wrap.style.width = mode === "gtd" ? "100%" : "100%";
    }
  }
  // ═══════════════════════ Tasks 面板 ═══════════════════════
  addTask() {
    this.el("tl-addArea").style.display = "block";
    this.el("tl-addInput").focus();
  }
  confirmAdd() {
    const inp = this.el("tl-addInput");
    const t = inp.value.trim();
    if (!t) return;
    const e = parseInt(this.el("tl-addEst").value) || 1;
    this.tasks.push({ id: this.tid++, text: t, est: e });
    this.el("tl-addInput").value = "";
    this.el("tl-addEst").value = "1";
    this.el("tl-addArea").style.display = "none";
    this.renderTasks();
    this.data.saveTasks(this.tasks).catch((e2) => console.warn("Tasks save failed:", e2));
  }
  cancelAdd() {
    this.el("tl-addInput").value = "";
    this.el("tl-addArea").style.display = "none";
  }
  toggleTask(id) {
    const t = this.tasks.find((x) => x.id === id);
    if (!t) return;
    this.data.appendCompletedTask(t.text).catch((e) => console.warn("Archive failed:", e));
    this.tasks = this.tasks.filter((x) => x.id !== id);
    this.renderTasks();
    this.data.saveTasks(this.tasks).catch((e) => console.warn("Tasks save failed:", e));
  }
  delTask(id) {
    this.tasks = this.tasks.filter((x) => x.id !== id);
    this.renderTasks();
    this.data.saveTasks(this.tasks).catch((e) => console.warn("Tasks save failed:", e));
  }
  renderTasks() {
    this.el("tl-tasks").innerHTML = this.tasks.map((t) => `
      <div class="tl-task">
        <div class="tl-task-left">
          <div class="tl-task-dot" data-taskid="${t.id}"></div>
          <span class="tl-task-text">${this.escHtml(t.text)}</span>
          <span class="tl-task-pomos">${t.est}p</span>
        </div>
        <button class="tl-task-del" data-taskid="${t.id}">&times;</button>
      </div>
    `).join("");
    this.el("tl-tasks").querySelectorAll(".tl-task-dot").forEach((d) => {
      d.onclick = () => this.toggleTask(parseInt(d.dataset.taskid));
    });
    this.el("tl-tasks").querySelectorAll(".tl-task-del").forEach((d) => {
      d.onclick = () => this.delTask(parseInt(d.dataset.taskid));
    });
    const estTotal = this.tasks.reduce((s, t) => s + t.est, 0);
    this.el("tl-estT").textContent = String(estTotal);
  }
  gtdShowAdd(col) {
    if (this.activeAddCol && this.activeAddCol !== col) {
      this.el(`tl-gtdAddRow-${this.activeAddCol}`).style.display = "none";
    }
    const row = this.el(`tl-gtdAddRow-${col}`);
    row.style.display = "flex";
    row.querySelector("input").focus();
    this.activeAddCol = col;
  }
  gtdConfirmAdd(col) {
    const row = this.el(`tl-gtdAddRow-${col}`);
    const inp = row.querySelector("input");
    const v = inp.value.trim();
    if (!v) {
      inp.focus();
      return;
    }
    this.gtdItems.push({ id: this.gtdId++, text: v, col });
    inp.value = "";
    row.style.display = "none";
    this.activeAddCol = null;
    this.renderGtd();
    this.data.saveGtdItems(this.gtdItems).catch((e) => console.warn("GTD save failed:", e));
  }
  gtdMove(id, col) {
    const item = this.gtdItems.find((x) => x.id === id);
    if (item) {
      item.col = col;
      this.gtdSelectedId = null;
    }
    this.renderGtd();
    this.data.saveGtdItems(this.gtdItems).catch((e) => console.warn("GTD save failed:", e));
  }
  gtdRemove(id) {
    this.gtdItems = this.gtdItems.filter((x) => x.id !== id);
    if (this.gtdSelectedId === id) this.gtdSelectedId = null;
    this.renderGtd();
    this.data.saveGtdItems(this.gtdItems).catch((e) => console.warn("GTD save failed:", e));
  }
  gtdSelect(id) {
    this.gtdSelectedId = this.gtdSelectedId === id ? null : id;
    this.renderGtd();
  }
  gtdRenameStart(id) {
    this.gtdRenamingId = id;
    this.gtdSelectedId = null;
    this.renderGtd();
  }
  gtdRenameSave(id, val) {
    const v = val.trim();
    if (v) {
      const item = this.gtdItems.find((x) => x.id === id);
      if (item) item.text = v;
    }
    this.gtdRenamingId = null;
    this.renderGtd();
    this.data.saveGtdItems(this.gtdItems).catch((e) => console.warn("GTD save failed:", e));
  }
  gtdRenameCancel() {
    this.gtdRenamingId = null;
    this.renderGtd();
  }
  renderGtd() {
    const cols = [
      { key: "inbox", elId: "tl-gtdColCapture" },
      { key: "clarify", elId: "tl-gtdColClarify" },
      { key: "next", elId: "tl-gtdColNext" },
      { key: "doing", elId: "tl-gtdColDoing" }
    ];
    const ACTIONS = {
      inbox: [{ col: "clarify", label: "Clarify" }, { col: "next", label: "Next" }],
      clarify: [{ col: "inbox", label: "Back" }, { col: "next", label: "Next" }],
      next: [{ col: "clarify", label: "Back" }, { col: "doing", label: "Do" }],
      doing: [{ col: "next", label: "Back" }, { del: true, label: "Done" }]
    };
    for (const { key, elId } of cols) {
      const items = this.gtdItems.filter((x) => x.col === key);
      const container = this.el(elId);
      let html = "";
      if (key === "clarify") {
        html += `<div class="tl-gtd-guide"><b>Is it actionable?</b><br><span class="tl-guide-no">NO</span> \u2192 discard, reference, or maybe later<br><span class="tl-guide-yes">YES</span> \u2192 what's the next step?<br>&nbsp;&nbsp;Quick (&lt;2min) \u2192 just do it<br>&nbsp;&nbsp;Assign \u2192 delegate<br>&nbsp;&nbsp;Queue \u2192 <b>[Next]</b></div>`;
      }
      if (items.length === 0 && key !== "clarify") {
        html += '<div class="tl-gtd-col-empty">\u2014</div>';
      }
      for (const item of items) {
        const sel = item.id === this.gtdSelectedId;
        html += `<div class="tl-gtd-col-item${sel ? " selected" : ""}" data-gtdid="${item.id}">`;
        if (item.id === this.gtdRenamingId) {
          html += `<input value="${this.escAttr(item.text)}" data-gtdid="${item.id}"
            style="flex:1;min-width:0;border:1px solid var(--tl-accent,#ba4949);border-radius:3px;padding:2px 4px;font-size:12px;font-family:inherit;outline:none" autofocus>`;
        } else {
          html += `<span style="flex:1;min-width:0">${this.escHtml(item.text)}</span>`;
        }
        html += `<button class="tl-gtd-item-x" data-gtdid="${item.id}">&times;</button></div>`;
        if (sel) {
          const acts = ACTIONS[key] || [];
          html += '<div class="tl-gtd-action-bar">';
          for (const a of acts) {
            if (a.del) {
              html += `<button class="tl-gtd-act-done" data-gtdid="${item.id}" data-action="done">${a.label}</button>`;
            } else {
              html += `<button data-gtdid="${item.id}" data-action="move" data-targetcol="${a.col}">${a.label}</button>`;
            }
          }
          html += `<button data-gtdid="${item.id}" data-action="rename">Rename</button>`;
          html += "</div>";
        }
      }
      container.innerHTML = html;
    }
    this.bindGtdEvents();
  }
  bindGtdEvents() {
    const c = this.containerEl.children[1];
    c.querySelectorAll(".tl-gtd-col-item").forEach((el) => {
      el.onclick = (e) => {
        const target = e.target;
        if (target.closest("input") || target.closest("button")) return;
        const id = parseInt(el.dataset.gtdid);
        this.gtdSelect(id);
      };
    });
    c.querySelectorAll(".tl-gtd-item-x").forEach((el) => {
      el.onclick = (e) => {
        e.stopPropagation();
        const id = parseInt(el.dataset.gtdid);
        this.gtdRemove(id);
      };
    });
    c.querySelectorAll(".tl-gtd-action-bar button").forEach((el) => {
      el.onclick = (e) => {
        e.stopPropagation();
        const btn = el;
        const id = parseInt(btn.dataset.gtdid);
        const action = btn.dataset.action;
        if (action === "move") {
          const col = btn.dataset.targetcol;
          this.gtdMove(id, col);
        } else if (action === "done") {
          const item = this.gtdItems.find((x) => x.id === id);
          if (item) {
            this.data.appendCompletedGtd(item.text).catch((e2) => console.warn("Archive failed:", e2));
          }
          this.gtdRemove(id);
        } else if (action === "rename") {
          this.gtdRenameStart(id);
        }
      };
    });
    c.querySelectorAll(".tl-gtd-col-body input").forEach((el) => {
      const inp = el;
      const id = parseInt(inp.dataset.gtdid);
      inp.onkeydown = (e) => {
        if (e.key === "Enter") this.gtdRenameSave(id, inp.value);
        if (e.key === "Escape") this.gtdRenameCancel();
      };
      inp.onblur = () => this.gtdRenameCancel();
      inp.onclick = (e) => e.stopPropagation();
    });
  }
  // ═══════════════════════ 辅助 ═══════════════════════
  escHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  escAttr(s) {
    return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
};

// src/data.ts
var DataManager = class {
  constructor(app, settings) {
    this.app = app;
    this.settings = settings;
  }
  // ═══════════════════════ 设置 ═══════════════════════
  async loadSettings() {
    return { ...DEFAULT_SETTINGS, ...this.settings };
  }
  // ═══════════════════════ Session 日志 ═══════════════════
  /** 获取今天的日期字符串 YYYY-MM-DD */
  getTodayStr() {
    return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  }
  /** 日志文件路径 */
  getLogPath(dateStr) {
    const base = this.settings.exportPath || "Pomodoro Logs";
    return `${base}/${dateStr || this.getTodayStr()}.md`;
  }
  /** 确保导出目录存在 */
  async ensureFolder() {
    const base = this.settings.exportPath || "Pomodoro Logs";
    const parts = base.split("/");
    let current = "";
    for (const part of parts) {
      current += (current ? "/" : "") + part;
      const folder = this.app.vault.getAbstractFileByPath(current);
      if (!folder) {
        await this.app.vault.createFolder(current);
      }
    }
  }
  /** 创建新的每日日志文件（含所有段落模板） */
  makeLogTemplate(dateStr) {
    return [
      `# Pomodoro Log \u2014 ${dateStr}`,
      "",
      "> Generated by Pomodoro",
      "",
      "---",
      "",
      `## Sessions \u2014 ${dateStr}`,
      "",
      `## Completed Tasks \u2014 ${dateStr}`,
      "",
      `## Completed GTD \u2014 ${dateStr}`,
      "",
      "---",
      ""
    ].join("\n");
  }
  /** 向每日日志的指定段落追加一行 */
  async appendToLog(section, entry) {
    await this.ensureFolder();
    const dateStr = this.getTodayStr();
    const path = this.getLogPath();
    let file = this.app.vault.getAbstractFileByPath(path);
    const sectionHeader = `## ${section} \u2014 ${dateStr}`;
    if (!file) {
      let template = this.makeLogTemplate(dateStr);
      template = template.replace(
        sectionHeader + "\n\n",
        sectionHeader + "\n\n" + entry + "\n"
      );
      await this.app.vault.create(path, template);
      return;
    }
    let content = await this.app.vault.read(file);
    const sectionIdx = content.indexOf(sectionHeader);
    if (sectionIdx >= 0) {
      const afterHeader = content.indexOf("\n", sectionIdx) + 1;
      const rest = content.slice(afterHeader);
      const nextBoundary = rest.search(/\n## |\n-{3}/);
      if (nextBoundary >= 0) {
        content = content.slice(0, afterHeader + nextBoundary) + entry + "\n" + content.slice(afterHeader + nextBoundary);
      } else {
        content = content.trimEnd() + "\n" + entry + "\n";
      }
    } else {
      const closeIdx = content.lastIndexOf("\n---");
      if (closeIdx >= 0) {
        content = content.slice(0, closeIdx + 1) + `
${sectionHeader}

${entry}

` + content.slice(closeIdx + 1);
      } else {
        content += `
${sectionHeader}

${entry}
`;
      }
    }
    await this.app.vault.modify(file, content);
  }
  /** 追加一个 session 到每日日志（改为复用 appendToLog） */
  async appendSession(session) {
    const entry = `- **${session.task || "Untitled"}** \u2014 ${session.duration}min (${session.preset}) | ${session.start} \u2192 ${session.end}`;
    await this.appendToLog("Sessions", entry);
  }
  /** 追加已完成任务到每日日志 */
  async appendCompletedTask(text) {
    const now = /* @__PURE__ */ new Date();
    const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    await this.appendToLog("Completed Tasks", `- [x] ${text} \u2705 ${time}`);
  }
  /** 追加已完成 GTD 条目到每日日志 */
  async appendCompletedGtd(text) {
    const now = /* @__PURE__ */ new Date();
    const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    await this.appendToLog("Completed GTD", `- [x] ${text} \u2705 ${time}`);
  }
  /** 加载今日 session 记录 */
  async loadTodaySessions() {
    const path = this.getLogPath();
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!file) return [];
    const content = await this.app.vault.read(file);
    const sessions = [];
    const re = /\*\*(.+?)\*\*\s*—\s*(\d+)min\s*\((.+?)\)\s*\|\s*(.+?)\s*→\s*(.+)/g;
    let match;
    while ((match = re.exec(content)) !== null) {
      sessions.push({
        task: match[1] === "Untitled" ? "" : match[1],
        duration: parseInt(match[2]),
        preset: match[3],
        start: match[4].trim(),
        end: match[5].trim()
      });
    }
    return sessions;
  }
  // ═══════════════════════ GTD Board ═══════════════════
  getGtdPath() {
    return `${this.settings.exportPath || "Pomodoro Logs"}/GTD Board.md`;
  }
  async saveGtdItems(items) {
    await this.ensureFolder();
    const path = this.getGtdPath();
    let file = this.app.vault.getAbstractFileByPath(path);
    const cols = [
      { key: "inbox", label: "Capture" },
      { key: "clarify", label: "Clarify" },
      { key: "next", label: "Next Actions" },
      { key: "doing", label: "Doing" }
    ];
    let md = `# GTD Board

> Auto-saved by Pomodoro

`;
    for (const col of cols) {
      const colItems = items.filter((i) => i.col === col.key);
      md += `## ${col.label}

`;
      if (colItems.length === 0) {
        md += `\u2014

`;
      } else {
        for (const item of colItems) {
          md += `- [ ] ${item.text}
`;
        }
        md += "\n";
      }
    }
    if (!file) {
      await this.app.vault.create(path, md);
    } else {
      await this.app.vault.modify(file, md);
    }
  }
  async loadGtdItems() {
    const path = this.getGtdPath();
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!file) return [];
    const content = await this.app.vault.read(file);
    const items = [];
    let idCounter = 0;
    const colMap = {
      "capture": "inbox",
      "clarify": "clarify",
      "next actions": "next",
      "doing": "doing"
    };
    const sections = content.split(/^## /gm);
    for (const section of sections) {
      const lines = section.split("\n");
      const header = lines[0].trim().toLowerCase();
      const col = colMap[header];
      if (!col) continue;
      for (let i = 1; i < lines.length; i++) {
        const m = lines[i].match(/^- \[.\] (.+)$/);
        if (m) {
          items.push({ id: idCounter++, text: m[1].trim(), col });
        }
      }
    }
    return items;
  }
  // ═══════════════════════ Tasks ═══════════════════
  getTasksPath() {
    return `${this.settings.exportPath || "Pomodoro Logs"}/Tasks.md`;
  }
  async saveTasks(tasks) {
    await this.ensureFolder();
    const path = this.getTasksPath();
    let file = this.app.vault.getAbstractFileByPath(path);
    let md = `# Tasks

> Auto-saved by Pomodoro

`;
    if (tasks.length === 0) {
      md += `_No tasks._
`;
    } else {
      for (const t of tasks) {
        md += `- [ ] ${t.text}${t.est > 1 ? ` (${t.est}p)` : ""}
`;
      }
    }
    if (!file) {
      await this.app.vault.create(path, md);
    } else {
      await this.app.vault.modify(file, md);
    }
  }
  async loadTasks() {
    const path = this.getTasksPath();
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!file) return [];
    const content = await this.app.vault.read(file);
    const tasks = [];
    let idCounter = 0;
    const lines = content.split("\n");
    for (const line of lines) {
      const m = line.match(/^- \[.\] (.+?)(?: \((\d+)p\))?\s*$/);
      if (m) {
        tasks.push({
          id: idCounter++,
          text: m[1].trim(),
          est: parseInt(m[2]) || 1
        });
      }
    }
    return tasks;
  }
};

// src/main.ts
var VIEW_TYPE2 = "tomato-life-view";
var TomatoSettingTab = class extends import_obsidian2.PluginSettingTab {
  constructor(plugin) {
    super(plugin.app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Pomodoro \u2014 \u8BBE\u7F6E" });
    new import_obsidian2.Setting(containerEl).setName("\u65E5\u5FD7\u5BFC\u51FA\u8DEF\u5F84").setDesc("Session \u65E5\u5FD7\u3001GTD Board\u3001Tasks \u6587\u4EF6\u7684\u5B58\u653E\u76EE\u5F55\uFF08\u76F8\u5BF9\u4E8E vault \u6839\u76EE\u5F55\uFF09").addText((text) => text.setPlaceholder("Pomodoro Logs").setValue(this.plugin.settings.exportPath).onChange(async (value) => {
      this.plugin.settings.exportPath = value.trim() || "Pomodoro Logs";
      await this.plugin.saveSettings();
    }));
  }
};
var TomatoPlugin = class extends import_obsidian2.Plugin {
  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.data = new DataManager(this.app, this.settings);
    this.registerView(VIEW_TYPE2, (leaf) => new TomatoView(leaf, this.data));
    this.addRibbonIcon("timer", "Pomodoro", () => this.activateView());
    this.addCommand({
      id: "open-tomato-life",
      name: "\u6253\u5F00 Pomodoro",
      callback: () => this.activateView()
    });
    this.addSettingTab(new TomatoSettingTab(this));
    this.app.workspace.onLayoutReady(() => {
      this.app.workspace.detachLeavesOfType(VIEW_TYPE2);
      this.activateView();
    });
  }
  async onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE2);
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  async activateView() {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE2);
    if (existing.length > 0) {
      this.app.workspace.revealLeaf(existing[0]);
      return;
    }
    try {
      const leaf = this.app.workspace.getLeaf("tab");
      await leaf.setViewState({ type: VIEW_TYPE2, active: true });
    } catch {
    }
  }
};
