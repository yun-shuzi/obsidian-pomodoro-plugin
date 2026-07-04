// ── 番茄人生 Obsidian 插件 — 类型定义 ──

export interface TimerPreset {
  focus: number;
  shortBreak: number;
  longBreak: number;
  color: string;
}

export type GtdColumn = 'inbox' | 'clarify' | 'next' | 'doing';

export interface GtdItem {
  id: number;
  text: string;
  col: GtdColumn;
}

export interface TaskItem {
  id: number;
  text: string;
  est: number;
}

export interface Session {
  start: string;
  end: string;
  duration: number;
  preset: string;
  task: string;
}

export interface TomatoSettings {
  exportPath: string;
}

export const DEFAULT_SETTINGS: TomatoSettings = {
  exportPath: 'Pomodoro Logs',
};

// 预设配置（颜色映射到原版）
export const PRESETS: Record<string, TimerPreset> = {
  '25/5':  { focus: 25, shortBreak: 5,  longBreak: 15, color: '#ba4949' },
  '52/17': { focus: 52, shortBreak: 17, longBreak: 17, color: '#38858a' },
  '90':    { focus: 90, shortBreak: 25, longBreak: 25, color: '#397097' },
};
