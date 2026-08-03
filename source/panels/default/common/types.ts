/**
 * @file types.ts
 * @description Luban 工具面板的核心数据接口与类型定义文件
 */

/** 页签名称类型 */
export type TabName = 'tab-1' | 'tab-2';

/** 日志类型 */
export type LogType = 'info' | 'success' | 'error';

/** 日志回调函数类型 */
export type LogCallback = (msg: string, type?: LogType) => void;

/** 单个语言配置接口 */
export interface LanguageItem {
    /** 语言代码 (如: zh-Hans, en, ja) */
    code: string;
    /** 语言展示名称 (如: 中文, 英文, 日文) */
    name: string;
}

/** Luban 工具面板完整持久化状态数据结构 */
export interface LubanToolState {
    /** 当前激活的页签 */
    activeTab: TabName;
    /** 配置表配置文件路径 (luban.conf) */
    cfgConfFile: string;
    /** 配置表代码输出目录 (outputCodeDir) */
    cfgCodeDir: string;
    /** 配置表数据输出目录 (outputDataDir) */
    cfgDataDir: string;
    /** 多语言配置文件路径 (luban.conf) */
    langConfFile: string;
    /** 多语言代码输出目录 (outputCodeDir) */
    langCodeDir: string;
    /** 已配置的多语言列表 */
    languages: LanguageItem[];
    /** 各语言的数据输出目录映射表 (langCode -> outputDataDir) */
    langDataDirs: Record<string, string>;
}

/** 面板上下文接口，用于向分面板传递全局能力 */
export interface PanelContext {
    /** 面板实例 */
    panel: any;
    /** 工作区根目录 */
    workspace: string;
    /** 日志打印方法 (仅向窗口面板输出) */
    appendLog: LogCallback;
    /** 清空日志方法 */
    clearLog: () => void;
    /** 禁用/启用界面全部按钮 */
    setAllButtonsDisabled: (disabled: boolean) => void;
}
