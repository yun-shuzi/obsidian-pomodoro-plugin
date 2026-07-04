// ── 番茄人生 Obsidian 插件 — 入口 ──

import {
  Plugin,
  WorkspaceLeaf,
  PluginSettingTab,
  Setting,
} from 'obsidian';
import { TomatoView } from './view';
import { DataManager } from './data';
import { TomatoSettings, DEFAULT_SETTINGS } from './types';

const VIEW_TYPE = 'tomato-life-view';

// ═══════════════════════ 设置面板 ═══════════════════════

class TomatoSettingTab extends PluginSettingTab {
  plugin: TomatoPlugin;

  constructor(plugin: TomatoPlugin) {
    super(plugin.app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Pomodoro — 设置' });

    new Setting(containerEl)
      .setName('日志导出路径')
      .setDesc('Session 日志、GTD Board、Tasks 文件的存放目录（相对于 vault 根目录）')
      .addText(text => text
        .setPlaceholder('Pomodoro Logs')
        .setValue(this.plugin.settings.exportPath)
        .onChange(async (value) => {
          this.plugin.settings.exportPath = value.trim() || 'Pomodoro Logs';
          await this.plugin.saveSettings();
        }));
  }
}

// ═══════════════════════ 插件主类 ═══════════════════════

export default class TomatoPlugin extends Plugin {
  settings!: TomatoSettings;
  data!: DataManager;

  async onload(): Promise<void> {
    // 加载设置
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.data = new DataManager(this.app, this.settings);

    // 注册自定义视图
    this.registerView(VIEW_TYPE, (leaf: WorkspaceLeaf) => new TomatoView(leaf, this.data));

    // 左侧 Ribbon 图标
    this.addRibbonIcon('timer', 'Pomodoro', () => this.activateView());

    // 命令面板
    this.addCommand({
      id: 'open-tomato-life',
      name: '打开 Pomodoro',
      callback: () => this.activateView(),
    });

    // 设置面板
    this.addSettingTab(new TomatoSettingTab(this));

    // 启动时清理残留标签（旧版本可能留在侧边栏），然后在主编辑区打开
    this.app.workspace.onLayoutReady(() => {
      this.app.workspace.detachLeavesOfType(VIEW_TYPE);
      this.activateView();
    });
  }

  async onunload(): Promise<void> {
    // 清理所有视图实例
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  async activateView(): Promise<void> {
    // 已有实例 → 直接揭示
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE);
    if (existing.length > 0) {
      this.app.workspace.revealLeaf(existing[0]);
      return;
    }

    // 在主编辑区创建标签页（和笔记一样的位置）
    const leaf = this.app.workspace.getLeaf('tab');
    await leaf.setViewState({ type: VIEW_TYPE, active: true });
  }
}
