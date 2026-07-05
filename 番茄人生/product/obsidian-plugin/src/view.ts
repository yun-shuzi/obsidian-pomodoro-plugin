// ── 番茄人生 Obsidian 插件 — 主视图（计时器 + GTD + Tasks） ──

import { ItemView, WorkspaceLeaf } from 'obsidian';
import { DataManager } from './data';
import {
  TimerPreset, GtdItem, GtdColumn,
  TaskItem, Session,
  PRESETS,
} from './types';

const VIEW_TYPE = 'tomato-life-view';

// ── helper ──
function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ── 番茄钟视图 ──
export class TomatoView extends ItemView {
  data: DataManager;

  // ── 计时器状态 ──
  preset: string = '25/5';       // 当前预设名
  subMode: string = 'focus';     // 'focus' | 'break' | 'break-long'
  sec: number = 25 * 60;
  run: boolean = false;
  iv: ReturnType<typeof setInterval> | null = null;
  round: number = 1;             // 25/5 四轮计数
  pomodoroCount: number = 0;
  taskMode: string = 'tasks';    // 'tasks' | 'gtd'
  customPreset: TimerPreset | null = null;

  // ── 数据 ──
  gtdItems: GtdItem[] = [];
  gtdId: number = 0;
  gtdSelectedId: number | null = null;
  gtdRenamingId: number | null = null;
  tasks: TaskItem[] = [];
  tid: number = 0;
  sessions: Session[] = [];
  sessionStart: string | null = null;

  // ── Obsidian API ──
  constructor(leaf: WorkspaceLeaf, data: DataManager) {
    super(leaf);
    this.data = data;
  }

  getViewType(): string { return VIEW_TYPE; }
  getDisplayText(): string { return 'Pomodoro'; }
  getIcon(): string { return 'timer'; }

  // ═══════════════════════ Lifecycle ═══════════════════════

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass('tomato-life-view');

    // 从 vault 加载数据
    this.gtdItems = await this.data.loadGtdItems();
    this.gtdId = this.gtdItems.length > 0
      ? Math.max(...this.gtdItems.map(i => i.id)) + 1 : 0;
    this.tasks = await this.data.loadTasks();
    this.tid = this.tasks.length > 0
      ? Math.max(...this.tasks.map(t => t.id)) + 1 : 0;
    this.sessions = await this.data.loadTodaySessions();
    this.pomodoroCount = this.sessions.length;

    this.buildUI();
    this.renderSubTabs();
    this.applyColors();
    this.upd();
    this.renderTasks();
    this.renderDotGrid();

    // 初始化预设标签事件
    container.querySelectorAll('#tl-presetTabs .tl-tab-btn').forEach(b =>
      (b as HTMLElement).onclick = () => this.setPreset((b as HTMLElement).dataset.preset!)
    );
    container.querySelectorAll('#tl-taskModeTabs .tl-tab-btn').forEach(b =>
      (b as HTMLElement).onclick = () => this.setTaskMode((b as HTMLElement).dataset.taskmode!)
    );

    this.startPolling();
  }

  async onClose(): Promise<void> {
    if (this.iv) clearInterval(this.iv);
    // 确保最新数据已保存
    this.stopPolling();
  }

  // ═══════════════════════ 文件轮询 ═══════════════════════

  private writing = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private tasksFingerprint = '';
  private gtdFingerprint = '';

  private startPolling(): void {
    const tasksPath = this.data.getTasksPath();
    const gtdPath = this.data.getGtdPath();
    this.updateTaskFingerprint(); this.updateGtdFingerprint();
    this.pollTimer = setInterval(async () => {
      if (this.writing) { this.updateTaskFingerprint(); this.updateGtdFingerprint(); return; }
      try {
        const tasksFile = this.app.vault.getAbstractFileByPath(tasksPath);
        if (tasksFile) { const c = await this.app.vault.read(tasksFile as any); if (c !== this.tasksFingerprint) { this.tasksFingerprint = c; this.tasks = await this.data.loadTasks(); this.tid = this.tasks.length > 0 ? Math.max(...this.tasks.map(t => t.id)) + 1 : 0; this.renderTasks(); } }
        const gtdFile = this.app.vault.getAbstractFileByPath(gtdPath);
        if (gtdFile) { const c = await this.app.vault.read(gtdFile as any); if (c !== this.gtdFingerprint) { this.gtdFingerprint = c; this.gtdItems = await this.data.loadGtdItems(); this.gtdId = this.gtdItems.length > 0 ? Math.max(...this.gtdItems.map(i => i.id)) + 1 : 0; this.renderGtd(); } }
      } catch {}
    }, 2000);
  }
  private updateTaskFingerprint(): void { const f = this.app.vault.getAbstractFileByPath(this.data.getTasksPath()); if (f) this.app.vault.read(f as any).then(c => { this.tasksFingerprint = c; }).catch(() => {}); }
  private updateGtdFingerprint(): void { const f = this.app.vault.getAbstractFileByPath(this.data.getGtdPath()); if (f) this.app.vault.read(f as any).then(c => { this.gtdFingerprint = c; }).catch(() => {}); }
  private stopPolling(): void { if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; } }

  // ═══════════════════════ UI 构建（一次性） ═══════════════════════

  private buildUI(): void {
    const c = this.containerEl.children[1] as HTMLElement;

    c.innerHTML = `
      <!-- 预设层 -->
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

    // ── 绑定事件 ──
    this.el('tl-startBtn').onclick = () => this.toggle();
    this.el('tl-skipBtn').onclick = () => this.skip();
    this.el('tl-clickToChange').onclick = () => this.toggleDurEdit();
    this.el('tl-saveDur').onclick = () => this.saveDuration();

    this.el('tl-addTaskBtn').onclick = () => this.addTask();
    this.el('tl-confirmAdd').onclick = () => this.confirmAdd();
    this.el('tl-cancelAdd').onclick = () => this.cancelAdd();
    this.el('tl-addInput').onkeydown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') this.confirmAdd();
    };

    // GTD Add 按钮
    ['inbox', 'clarify', 'next'].forEach(col => {
      this.el(`tl-gtdAdd-${col}`).onclick = () => this.gtdShowAdd(col);
      const row = this.el(`tl-gtdAddRow-${col}`);
      const inp = row.querySelector('input') as HTMLInputElement;
      const btn = row.querySelector('button') as HTMLElement;
      inp.onkeydown = (e: KeyboardEvent) => {
        if (e.key === 'Enter') this.gtdConfirmAdd(col);
      };
      btn.onclick = () => this.gtdConfirmAdd(col);
    });
  }

  private el(id: string): HTMLElement {
    return this.containerEl.querySelector(`#${id}`) as HTMLElement;
  }

  // ═══════════════════════ 计时器引擎 ═══════════════════════

  private upd(): void {
    this.el('tl-time').textContent = fmt(this.sec);
  }

  private getPreset(): TimerPreset {
    if (this.preset === 'custom') {
      if (!this.customPreset) {
        const cp = PRESETS['25/5'];
        this.customPreset = { focus: cp.focus, shortBreak: cp.shortBreak, longBreak: cp.shortBreak, color: '#7a5c8a' };
      }
      return this.customPreset;
    }
    return PRESETS[this.preset];
  }

  private getSubTabs(): { id: string; label: string; color: string; min: number }[] {
    const p = this.getPreset();
    if (this.preset === '25/5') {
      return [
        { id: 'focus', label: 'Focus', color: p.color, min: p.focus },
        { id: 'break', label: 'Short Break', color: '#38858a', min: p.shortBreak },
        { id: 'break-long', label: 'Long Break', color: '#397097', min: p.longBreak },
      ];
    }
    return [
      { id: 'focus', label: 'Focus', color: p.color, min: p.focus },
      { id: 'break', label: 'Break', color: p.color, min: p.shortBreak },
    ];
  }

  renderSubTabs(): void {
    const tabs = this.getSubTabs();
    const html = tabs.map(t =>
      `<button class="tl-tab-btn${this.subMode === t.id ? ' active' : ''}" data-submode="${t.id}">${t.label}</button>`
    ).join('');
    this.el('tl-subTabs').innerHTML = html;
    this.el('tl-subTabs').querySelectorAll('.tl-tab-btn').forEach(b =>
      (b as HTMLElement).onclick = () => this.setSubMode((b as HTMLElement).dataset.submode!)
    );
  }

  applyColors(): void {
    const tabs = this.getSubTabs();
    const t = tabs.find(x => x.id === this.subMode) || tabs[0];
    const container = this.containerEl.children[1] as HTMLElement;

    container.style.background = t.color;
    container.classList.remove('mode--break-short', 'mode--break-long');
    if (this.subMode === 'break') {
      container.classList.add('mode--break-short');
    } else if (this.subMode === 'break-long') {
      container.classList.add('mode--break-long');
    }

    const startBtn = this.el('tl-startBtn');
    startBtn.style.color = t.color;

    container.querySelectorAll('.tl-task-dot.done').forEach(d => {
      (d as HTMLElement).style.background = t.color;
      (d as HTMLElement).style.borderColor = t.color;
    });

    container.style.setProperty('--tl-accent', t.color);
  }

  setPreset(p: string): void {
    if (this.run) this.toggle();
    if (p === 'custom' && !this.customPreset) {
      const cp = this.getPreset();
      this.customPreset = { focus: cp.focus, shortBreak: cp.shortBreak, longBreak: cp.shortBreak, color: '#7a5c8a' };
    }
    this.preset = p;
    this.subMode = 'focus';
    this.sec = this.getPreset().focus * 60;
    this.upd();

    this.el('tl-presetTabs').querySelectorAll('.tl-tab-btn').forEach(b =>
      b.classList.toggle('active', (b as HTMLElement).dataset.preset === p)
    );

    this.renderSubTabs();
    this.applyColors();

    this.el('tl-startBtn').textContent = 'START';
    this.el('tl-startBtn').className = 'tl-btn-start';
    this.el('tl-skipBtn').style.visibility = 'hidden';

    this.el('tl-freeEditToggle').style.display = (p === 'custom') ? 'block' : 'none';
    this.el('tl-durEdit').style.display = 'none';
  }

  setSubMode(m: string): void {
    if (this.run) this.toggle();
    this.subMode = m;
    const tabs = this.getSubTabs();
    const t = tabs.find(x => x.id === m) || tabs[0];
    this.sec = t.min * 60;
    this.upd();

    this.el('tl-subTabs').querySelectorAll('.tl-tab-btn').forEach(b =>
      b.classList.toggle('active', (b as HTMLElement).dataset.submode === m)
    );

    this.applyColors();

    this.el('tl-startBtn').textContent = 'START';
    this.el('tl-startBtn').className = 'tl-btn-start';
    this.el('tl-skipBtn').style.visibility = (m === 'focus') ? 'hidden' : 'visible';
  }

  // ── 自由模式时长编辑 ──
  toggleDurEdit(): void {
    const ed = this.el('tl-durEdit');
    if (ed.style.display === 'none' || !ed.style.display) {
      if (this.run) return;
      const p = this.getPreset();
      (this.el('tl-durFocus') as HTMLInputElement).value = String(p.focus);
      (this.el('tl-durBreak') as HTMLInputElement).value = String(p.shortBreak);
      ed.style.display = 'block';
      this.el('tl-durFocus').focus();
    } else {
      ed.style.display = 'none';
    }
  }

  saveDuration(): void {
    const f = parseInt((this.el('tl-durFocus') as HTMLInputElement).value);
    const b = parseInt((this.el('tl-durBreak') as HTMLInputElement).value);
    if (!f || !b || f < 1 || b < 1) return;
    this.el('tl-durEdit').style.display = 'none';
    this.customPreset = { focus: f, shortBreak: b, longBreak: b, color: '#7a5c8a' };
    this.setPreset('custom');
  }

  // ── 计时器主逻辑 ──
  toggle(): void {
    this.run = !this.run;

    const startBtn = this.el('tl-startBtn');
    startBtn.textContent = this.run ? 'PAUSE' : 'START';
    startBtn.className = 'tl-btn-start' + (this.run ? ' is-paused' : '');

    const tabs = this.getSubTabs();
    const t = tabs.find(x => x.id === this.subMode);
    startBtn.style.color = this.run ? '#fff' : (t?.color || '#ba4949');

    this.el('tl-skipBtn').style.visibility = this.run
      ? 'visible'
      : (this.subMode === 'focus' ? 'hidden' : 'visible');

    if (this.run) {
      if (this.subMode === 'focus') {
        this.sessionStart = new Date().toISOString();
      }
      const startMs = Date.now();
      const totalSec = this.sec;
      this.iv = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startMs) / 1000);
        this.sec = Math.max(0, totalSec - elapsed);
        this.upd();
        if (this.sec <= 0) {
          clearInterval(this.iv!);
          this.iv = null;
          this.run = false;
          this.el('tl-startBtn').textContent = 'START';
          this.el('tl-startBtn').className = 'tl-btn-start';
          this.onTimerEnd();
        }
      }, 1000);
    } else {
      if (this.iv) { clearInterval(this.iv); this.iv = null; }
      this.sessionStart = null;
    }
  }

  private onTimerEnd(): void {
    this.playBell();
    if (this.subMode === 'focus') {
      // 记录 session
      const end = new Date().toISOString();
      const p = this.getPreset();
      const dur = p.focus; // 计划时长
      const doingItem = this.gtdItems.find(x => x.col === 'doing');

      const session: Session = {
        start: this.sessionStart || end,
        end,
        duration: dur,
        preset: this.preset,
        task: doingItem ? doingItem.text : '',
      };
      this.sessions.push(session);
      this.sessionStart = null;

      // 异步保存（fire-and-forget，不阻塞 UI）
      this.data.appendSession(session).catch(e => console.warn('Session save failed:', e));

      this.pomodoroCount++;
      this.renderDotGrid();
      this.round++;

      this.setSubMode(
        this.round % 4 === 0 && this.preset === '25/5' ? 'break-long' : 'break'
      );
    } else {
      this.setSubMode('focus');
    }
  }

  skip(): void {
    if (this.run) this.toggle();
    if (this.subMode === 'focus') {
      this.pomodoroCount++;
      this.renderDotGrid();
      this.round++;
      this.setSubMode(
        this.round % 4 === 0 && this.preset === '25/5' ? 'break-long' : 'break'
      );
    } else {
      this.setSubMode('focus');
    }
  }

  private playBell(): void {
    try {
      const ctx = new AudioContext();
      // 恢复被浏览器挂起的 AudioContext
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;
      // 四音下行：C6 → G5 → E5 → C5，每个持续 0.5s，更响更悠长
      const notes = [1046.5, 783.99, 659.25, 523.25];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.type = 'sine'; osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.6, now + i * 0.2);
        gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.2 + 0.6);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(now + i * 0.2); osc.stop(now + i * 0.2 + 0.7);
      });
    } catch {}
  }

  // ═══════════════════════ 点阵 ═══════════════════════

  renderDotGrid(): void {
    const MAX = 30;
    const count = Math.min(this.pomodoroCount, MAX);
    let html = '';
    for (let i = 0; i < MAX; i++) {
      html += `<div class="tl-grid-dot${i < count ? ' lit' : ''}" data-dotidx="${i}"></div>`;
    }
    this.el('tl-dotGrid').innerHTML = html;
    this.el('tl-dotGrid').querySelectorAll('.tl-grid-dot').forEach(d => {
      (d as HTMLElement).onclick = () => this.toggleDot(parseInt((d as HTMLElement).dataset.dotidx!));
    });
  }

  toggleDot(i: number): void {
    this.pomodoroCount = i < this.pomodoroCount ? i : i + 1;
    this.renderDotGrid();
  }

  // ═══════════════════════ 任务模式切换 ═══════════════════════

  setTaskMode(mode: string): void {
    this.taskMode = mode;

    this.el('tl-taskModeTabs').querySelectorAll('.tl-tab-btn').forEach(b =>
      b.classList.toggle('active', (b as HTMLElement).dataset.taskmode === mode)
    );

    this.el('tl-taskModeLabel').textContent = mode === 'tasks' ? 'Tasks' : 'GTD';
    this.el('tl-addTaskBtn').style.display = mode === 'tasks' ? 'inline-block' : 'none';
    this.el('tl-tasksContent').style.display = mode === 'tasks' ? 'block' : 'none';
    this.el('tl-gtdContent').style.display = mode === 'gtd' ? 'block' : 'none';
    if (mode === 'gtd') this.renderGtd();
    if (mode === 'tasks') this.renderTasks();

    const wrap = this.containerEl.querySelector('.tl-tasks-wrap') as HTMLElement;
    if (wrap) {
      wrap.style.maxWidth = mode === 'gtd' ? '1400px' : '480px';
      wrap.style.width = mode === 'gtd' ? '100%' : '100%';
    }
  }

  // ═══════════════════════ Tasks 面板 ═══════════════════════

  addTask(): void {
    this.el('tl-addArea').style.display = 'block';
    this.el('tl-addInput').focus();
  }

  confirmAdd(): void {
    const inp = this.el('tl-addInput') as HTMLInputElement;
    const t = inp.value.trim();
    if (!t) return;
    const e = parseInt((this.el('tl-addEst') as HTMLInputElement).value) || 1;
    this.tasks.push({ id: this.tid++, text: t, est: e });
    (this.el('tl-addInput') as HTMLInputElement).value = '';
    (this.el('tl-addEst') as HTMLInputElement).value = '1';
    this.el('tl-addArea').style.display = 'none';
    this.renderTasks();
    this.data.saveTasks(this.tasks).catch(e => console.warn('Tasks save failed:', e));
  }

  cancelAdd(): void {
    (this.el('tl-addInput') as HTMLInputElement).value = '';
    this.el('tl-addArea').style.display = 'none';
  }

  toggleTask(id: number): void {
    const t = this.tasks.find(x => x.id === id);
    if (!t) return;
    // 完成 → 从工作文件移除，归档到每日日志
    this.data.appendCompletedTask(t.text).catch(e => console.warn('Archive failed:', e));
    this.tasks = this.tasks.filter(x => x.id !== id);
    this.renderTasks();
    this.data.saveTasks(this.tasks).catch(e => console.warn('Tasks save failed:', e));
  }

  delTask(id: number): void {
    this.tasks = this.tasks.filter(x => x.id !== id);
    this.renderTasks();
    this.data.saveTasks(this.tasks).catch(e => console.warn('Tasks save failed:', e));
  }

  renderTasks(): void {
    this.el('tl-tasks').innerHTML = this.tasks.map(t => `
      <div class="tl-task">
        <div class="tl-task-left">
          <div class="tl-task-dot" data-taskid="${t.id}"></div>
          <span class="tl-task-text">${this.escHtml(t.text)}</span>
          <span class="tl-task-pomos">${t.est}p</span>
        </div>
        <button class="tl-task-del" data-taskid="${t.id}">&times;</button>
      </div>
    `).join('');

    // 绑定事件
    this.el('tl-tasks').querySelectorAll('.tl-task-dot').forEach(d => {
      (d as HTMLElement).onclick = () => this.toggleTask(parseInt((d as HTMLElement).dataset.taskid!));
    });
    this.el('tl-tasks').querySelectorAll('.tl-task-del').forEach(d => {
      (d as HTMLElement).onclick = () => this.delTask(parseInt((d as HTMLElement).dataset.taskid!));
    });

    const estTotal = this.tasks.reduce((s, t) => s + t.est, 0);
    this.el('tl-estT').textContent = String(estTotal);
  }

  // ═══════════════════════ GTD 面板 ═══════════════════════

  private activeAddCol: string | null = null;

  gtdShowAdd(col: string): void {
    // 先关闭其他输入行
    if (this.activeAddCol && this.activeAddCol !== col) {
      this.el(`tl-gtdAddRow-${this.activeAddCol}`).style.display = 'none';
    }
    const row = this.el(`tl-gtdAddRow-${col}`);
    row.style.display = 'flex';
    (row.querySelector('input') as HTMLInputElement).focus();
    this.activeAddCol = col;
  }

  gtdConfirmAdd(col: string): void {
    const row = this.el(`tl-gtdAddRow-${col}`);
    const inp = row.querySelector('input') as HTMLInputElement;
    const v = inp.value.trim();
    if (!v) { inp.focus(); return; }

    this.gtdItems.push({ id: this.gtdId++, text: v, col: col as GtdColumn });
    inp.value = '';
    row.style.display = 'none';
    this.activeAddCol = null;
    this.renderGtd();
    this.data.saveGtdItems(this.gtdItems).catch(e => console.warn('GTD save failed:', e));
  }

  gtdMove(id: number, col: string): void {
    const item = this.gtdItems.find(x => x.id === id);
    if (item) {
      item.col = col as GtdColumn;
      this.gtdSelectedId = null;
    }
    this.renderGtd();
    this.data.saveGtdItems(this.gtdItems).catch(e => console.warn('GTD save failed:', e));
  }

  gtdRemove(id: number): void {
    this.gtdItems = this.gtdItems.filter(x => x.id !== id);
    if (this.gtdSelectedId === id) this.gtdSelectedId = null;
    this.renderGtd();
    this.data.saveGtdItems(this.gtdItems).catch(e => console.warn('GTD save failed:', e));
  }

  gtdSelect(id: number): void {
    this.gtdSelectedId = this.gtdSelectedId === id ? null : id;
    this.renderGtd();
  }

  gtdRenameStart(id: number): void {
    this.gtdRenamingId = id;
    this.gtdSelectedId = null;
    this.renderGtd();
  }

  gtdRenameSave(id: number, val: string): void {
    const v = val.trim();
    if (v) {
      const item = this.gtdItems.find(x => x.id === id);
      if (item) item.text = v;
    }
    this.gtdRenamingId = null;
    this.renderGtd();
    this.data.saveGtdItems(this.gtdItems).catch(e => console.warn('GTD save failed:', e));
  }

  gtdRenameCancel(): void {
    this.gtdRenamingId = null;
    this.renderGtd();
  }

  renderGtd(): void {
    const cols: { key: string; elId: string }[] = [
      { key: 'inbox', elId: 'tl-gtdColCapture' },
      { key: 'clarify', elId: 'tl-gtdColClarify' },
      { key: 'next', elId: 'tl-gtdColNext' },
      { key: 'doing', elId: 'tl-gtdColDoing' },
    ];

    const ACTIONS: Record<string, { col?: string; label: string; del?: boolean }[]> = {
      inbox:   [{ col: 'clarify', label: 'Clarify' }, { col: 'next', label: 'Next' }],
      clarify: [{ col: 'inbox', label: 'Back' }, { col: 'next', label: 'Next' }],
      next:    [{ col: 'clarify', label: 'Back' }, { col: 'doing', label: 'Do' }],
      doing:   [{ col: 'next', label: 'Back' }, { del: true, label: 'Done' }],
    };

    for (const { key, elId } of cols) {
      const items = this.gtdItems.filter(x => x.col === key);
      const container = this.el(elId);
      let html = '';

      if (key === 'clarify') {
        html += '<div class="tl-gtd-guide"><b>Is it actionable?</b><br>' +
          '<span class="tl-guide-no">NO</span> → discard, reference, or maybe later<br>' +
          '<span class="tl-guide-yes">YES</span> → what\'s the next step?<br>' +
          '&nbsp;&nbsp;Quick (&lt;2min) → just do it<br>' +
          '&nbsp;&nbsp;Assign → delegate<br>' +
          '&nbsp;&nbsp;Queue → <b>[Next]</b></div>';
      }

      if (items.length === 0 && key !== 'clarify') {
        html += '<div class="tl-gtd-col-empty">—</div>';
      }

      for (const item of items) {
        const sel = item.id === this.gtdSelectedId;
        html += `<div class="tl-gtd-col-item${sel ? ' selected' : ''}" data-gtdid="${item.id}">`;

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
          html += '</div>';
        }
      }

      container.innerHTML = html;
    }

    // ── 绑定事件 ──
    this.bindGtdEvents();
  }

  private bindGtdEvents(): void {
    const c = this.containerEl.children[1] as HTMLElement;

    // 条目点击 → 选中
    c.querySelectorAll('.tl-gtd-col-item').forEach(el => {
      (el as HTMLElement).onclick = (e) => {
        const target = e.target as HTMLElement;
        if (target.closest('input') || target.closest('button')) return;
        const id = parseInt((el as HTMLElement).dataset.gtdid!);
        this.gtdSelect(id);
      };
    });

    // × 删除
    c.querySelectorAll('.tl-gtd-item-x').forEach(el => {
      (el as HTMLElement).onclick = (e) => {
        e.stopPropagation();
        const id = parseInt((el as HTMLElement).dataset.gtdid!);
        this.gtdRemove(id);
      };
    });

    // 操作栏按钮
    c.querySelectorAll('.tl-gtd-action-bar button').forEach(el => {
      (el as HTMLElement).onclick = (e) => {
        e.stopPropagation();
        const btn = el as HTMLElement;
        const id = parseInt(btn.dataset.gtdid!);
        const action = btn.dataset.action;

        if (action === 'move') {
          const col = btn.dataset.targetcol!;
          this.gtdMove(id, col);
        } else if (action === 'done') {
          const item = this.gtdItems.find(x => x.id === id);
          if (item) {
            this.data.appendCompletedGtd(item.text).catch(e => console.warn('Archive failed:', e));
          }
          this.gtdRemove(id);
        } else if (action === 'rename') {
          this.gtdRenameStart(id);
        }
      };
    });

    // 重命名输入框
    c.querySelectorAll('.tl-gtd-col-body input').forEach(el => {
      const inp = el as HTMLInputElement;
      const id = parseInt(inp.dataset.gtdid!);
      inp.onkeydown = (e: KeyboardEvent) => {
        if (e.key === 'Enter') this.gtdRenameSave(id, inp.value);
        if (e.key === 'Escape') this.gtdRenameCancel();
      };
      inp.onblur = () => this.gtdRenameCancel();
      // 阻止冒泡以免触发选中
      inp.onclick = (e) => e.stopPropagation();
    });
  }

  // ═══════════════════════ 辅助 ═══════════════════════

  private escHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  private escAttr(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
